"""
Background watchlist checker — runs on a loop and surfaces changes as alerts.

Checks:
  IOC   — VirusTotal verdict flip / detection spike, AbuseIPDB score spike
  CVE   — New CISA KEV entry, EPSS score spike, CVSS change
  Vendor— New CVEs mentioning the vendor/company/software (via NVD keyword search)
          + recent news for cyber incidents, data breaches, third-party risk events
"""

import asyncio
import base64
from datetime import datetime, timezone, timedelta
from typing import Any

import feedparser
import httpx

from config import settings
from routers.watchlist import read_watchlist, write_watchlist
from routers.alerts_router import create_alert
from routers.enrich import _detect, _defang

_NVD = "https://services.nvd.nist.gov/rest/json/cves/2.0"
_EPSS = "https://api.first.org/data/v1/epss"
_VT = "https://www.virustotal.com/api/v3"
_ABUSE = "https://api.abuseipdb.com/api/v2"
_GNEWS_RSS = "https://news.google.com/rss/search"
_RANSOMWARE_LIVE = "https://api.ransomware.live/v1"

_INCIDENT_KEYWORDS = (
    "breach", "data breach", "data leak", "hacked", "ransomware",
    "cyberattack", "cyber attack", "incident", "compromised", "compromise",
    "data theft", "stolen data", "unauthorized access", "security incident",
    "extortion", "malware", "data exposure", "third-party risk",
    "supply chain attack", "vendor breach",
)


# ── IOC checker ────────────────────────────────────────────────────────────────

def _vt_verdict(stats: dict) -> str:
    m = stats.get("malicious", 0)
    s = stats.get("suspicious", 0)
    if m >= 3:
        return "malicious"
    if m >= 1 or s >= 3:
        return "suspicious"
    return "clean"


async def _check_ioc(client: httpx.AsyncClient, item: dict) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    raw = _defang(item["value"])
    ioc_type = _detect(raw)
    last = item.get("last_state") or {}

    # ── VirusTotal ──
    if settings.virustotal_api_key:
        try:
            h = {"x-apikey": settings.virustotal_api_key}
            if ioc_type == "ip":
                r = await client.get(f"{_VT}/ip_addresses/{raw}", headers=h)
            elif ioc_type == "domain":
                r = await client.get(f"{_VT}/domains/{raw}", headers=h)
            elif ioc_type in ("md5", "sha1", "sha256"):
                r = await client.get(f"{_VT}/files/{raw}", headers=h)
            elif ioc_type == "url":
                uid = base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")
                r = await client.get(f"{_VT}/urls/{uid}", headers=h)
            else:
                r = None

            if r and r.status_code == 200:
                stats = r.json()["data"]["attributes"].get("last_analysis_stats", {})
                malicious = stats.get("malicious", 0)
                total = max(sum(stats.values()), 1)
                verdict = _vt_verdict(stats)

                old_verdict = last.get("vt_verdict", "unknown")
                old_malicious = last.get("vt_malicious", 0)

                if old_verdict in ("clean", "unknown") and verdict == "malicious":
                    alerts.append({
                        "alert_type": "verdict_flip",
                        "severity": "critical",
                        "title": f"{raw} flipped to MALICIOUS",
                        "detail": f"VirusTotal: {malicious}/{total} engines now flag this indicator. Previously clean/unknown.",
                    })
                elif verdict == "suspicious" and old_verdict == "clean":
                    alerts.append({
                        "alert_type": "verdict_flip",
                        "severity": "high",
                        "title": f"{raw} flagged as SUSPICIOUS",
                        "detail": f"VirusTotal: {malicious}/{total} engines flag this indicator as suspicious.",
                    })
                elif malicious > old_malicious + 5:
                    alerts.append({
                        "alert_type": "detection_increase",
                        "severity": "high",
                        "title": f"{raw} detection count increased",
                        "detail": f"VirusTotal detections rose from {old_malicious} to {malicious}/{total} engines.",
                    })

                item["last_state"] = {
                    **(item.get("last_state") or {}),
                    "vt_verdict": verdict,
                    "vt_malicious": malicious,
                    "vt_total": total,
                }
        except Exception as e:
            print(f"    VT check failed for {raw}: {e}")

    # ── AbuseIPDB (IPs only) ──
    if ioc_type == "ip" and settings.abuseipdb_api_key:
        try:
            r = await client.get(
                f"{_ABUSE}/check",
                params={"ipAddress": raw, "maxAgeInDays": 90},
                headers={"Key": settings.abuseipdb_api_key, "Accept": "application/json"},
            )
            if r.status_code == 200:
                score = r.json().get("data", {}).get("abuseConfidenceScore", 0)
                old_score = last.get("abuse_score", 0)
                if score - old_score >= 25:
                    alerts.append({
                        "alert_type": "score_change",
                        "severity": "high",
                        "title": f"{raw} AbuseIPDB score spiked to {score}%",
                        "detail": f"Abuse confidence score increased from {old_score}% to {score}%.",
                    })
                item["last_state"] = {**(item.get("last_state") or {}), "abuse_score": score}
        except Exception as e:
            print(f"    AbuseIPDB check failed for {raw}: {e}")

    return alerts


# ── CVE checker ────────────────────────────────────────────────────────────────

async def _check_cve(client: httpx.AsyncClient, item: dict) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    cve_id = item["value"].upper()
    last = item.get("last_state") or {}

    try:
        # NVD lookup
        r = await client.get(
            _NVD,
            params={"cveId": cve_id},
            headers={"User-Agent": "SkillCTI/2.0"},
        )
        in_kev = False
        cvss_score = None

        if r.status_code == 200:
            vulns = r.json().get("vulnerabilities", [])
            if vulns:
                cve_data = vulns[0].get("cve", {})
                in_kev = "cisaExploitAdd" in cve_data
                metrics = cve_data.get("metrics", {})
                for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
                    if key in metrics and metrics[key]:
                        cvss_score = metrics[key][0]["cvssData"]["baseScore"]
                        break

        # EPSS lookup
        epss_score: float | None = None
        r2 = await client.get(_EPSS, params={"cve": cve_id})
        if r2.status_code == 200 and r2.json().get("data"):
            epss_score = float(r2.json()["data"][0].get("epss", 0))

        # Alert: new KEV
        if in_kev and not last.get("in_kev"):
            alerts.append({
                "alert_type": "new_kev",
                "severity": "critical",
                "title": f"{cve_id} added to CISA KEV",
                "detail": f"{cve_id} has been added to the CISA Known Exploited Vulnerabilities catalog. Immediate remediation required.",
            })

        # Alert: EPSS spike
        if epss_score is not None:
            old_epss = last.get("epss", 0.0)
            if epss_score - old_epss >= 0.1:
                alerts.append({
                    "alert_type": "epss_spike",
                    "severity": "high",
                    "title": f"{cve_id} EPSS score spiked to {epss_score:.1%}",
                    "detail": f"Exploitation probability increased from {old_epss:.1%} to {epss_score:.1%}.",
                })

        # Alert: CVSS change
        if cvss_score is not None and last.get("cvss") is not None:
            old_cvss = last["cvss"]
            if abs(cvss_score - old_cvss) >= 1.0:
                alerts.append({
                    "alert_type": "score_change",
                    "severity": "medium",
                    "title": f"{cve_id} CVSS score updated to {cvss_score}",
                    "detail": f"CVSS base score changed from {old_cvss} to {cvss_score}.",
                })

        item["last_state"] = {
            "in_kev": in_kev,
            "epss": epss_score,
            "cvss": cvss_score,
        }

    except Exception as e:
        print(f"    CVE check failed for {cve_id}: {e}")

    return alerts


# ── Vendor / third-party checker ───────────────────────────────────────────────

async def _check_vendor_news(client: httpx.AsyncClient, item: dict) -> list[dict[str, Any]]:
    """Search Google News RSS for recent cyber incidents / data breaches mentioning the vendor."""
    alerts: list[dict[str, Any]] = []
    vendor = item["value"]
    last = item.get("last_state") or {}
    seen_urls: set[str] = set(last.get("seen_news_urls", []))

    query = (
        f'"{vendor}" '
        '(breach OR "data breach" OR hacked OR ransomware OR '
        '"cyber attack" OR "security incident" OR "data leak" OR compromise OR '
        '"supply chain" OR "third-party")'
    )

    try:
        r = await client.get(
            _GNEWS_RSS,
            params={"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"},
            headers={"User-Agent": "SkillCTI/2.0 (+threat-intelligence-platform)"},
            follow_redirects=True,
            timeout=20,
        )
        if r.status_code != 200:
            return alerts

        parsed = feedparser.parse(r.text)
        new_articles: list[dict] = []

        for entry in parsed.entries[:25]:
            url = entry.get("link", "").strip()
            title = entry.get("title", "").strip()
            if not url or not title or url in seen_urls:
                continue
            seen_urls.add(url)
            text = (title + " " + entry.get("summary", "")).lower()
            if any(kw in text for kw in _INCIDENT_KEYWORDS):
                new_articles.append({"title": title, "url": url})

        if new_articles:
            severity = "critical" if len(new_articles) >= 5 else "high" if len(new_articles) >= 2 else "medium"
            alerts.append({
                "alert_type": "news_incident",
                "severity": severity,
                "title": f"{len(new_articles)} new security incident report{'s' if len(new_articles) != 1 else ''} for {vendor}",
                "detail": f"Recent news indicates potential cyber incidents or data breaches involving {vendor}.",
                "matches": new_articles,
            })

        # Persist seen URLs (cap at 500 to avoid unbounded growth)
        item["last_state"] = {
            **(item.get("last_state") or {}),
            "seen_news_urls": list(seen_urls)[-500:],
        }

    except Exception as e:
        print(f"    News check failed for {vendor}: {e}")

    return alerts


async def _check_vendor(client: httpx.AsyncClient, item: dict) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    vendor = item["value"]

    last_checked = item.get("last_checked")
    if last_checked:
        try:
            start_dt = datetime.fromisoformat(last_checked)
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
        except Exception:
            start_dt = datetime.now(timezone.utc) - timedelta(days=7)
    else:
        start_dt = datetime.now(timezone.utc) - timedelta(days=7)

    start_str = start_dt.strftime("%Y-%m-%dT%H:%M:%S.000")
    end_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000")

    try:
        r = await client.get(
            _NVD,
            params={
                "keywordSearch": vendor,
                "pubStartDate": start_str,
                "pubEndDate": end_str,
                "resultsPerPage": 20,
            },
            headers={"User-Agent": "SkillCTI/2.0"},
        )
        if r.status_code == 200:
            data = r.json()
            total = data.get("totalResults", 0)
            if total > 0:
                vulns = data.get("vulnerabilities", [])
                scores = []
                for v in vulns:
                    metrics = v.get("cve", {}).get("metrics", {})
                    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
                        if key in metrics and metrics[key]:
                            scores.append(metrics[key][0]["cvssData"]["baseScore"])
                            break

                max_score = max(scores) if scores else 0.0
                severity = "critical" if max_score >= 9 else "high" if max_score >= 7 else "medium"

                cve_ids = [v["cve"]["id"] for v in vulns[:5] if "cve" in v]
                preview = ", ".join(cve_ids)
                if total > 5:
                    preview += f" +{total - 5} more"

                alerts.append({
                    "alert_type": "new_cve",
                    "severity": severity,
                    "title": f"{total} new CVE{'s' if total != 1 else ''} affecting {vendor}",
                    "detail": f"New vulnerabilities published since last check: {preview}. Highest CVSS: {max_score:.1f}.",
                })
    except Exception as e:
        print(f"    Vendor check failed for {vendor}: {e}")

    # Merge CVE state (preserves seen_news_urls set by _check_vendor_news below)
    item["last_state"] = {**(item.get("last_state") or {})}

    # News / incident check
    news_alerts = await _check_vendor_news(client, item)
    alerts.extend(news_alerts)

    return alerts


# ── Threat actor checker ───────────────────────────────────────────────────────

_ACTOR_ACTIVITY_KEYWORDS = (
    "campaign", "attack", "malware", "infrastructure", "victims",
    "indicators", "tactics", "techniques", "ransomware", "espionage",
    "intrusion", "operation", "threat actor", "apt", "indictment",
    "sanctions", "attribution", "backdoor", "phishing", "zero-day",
    "exploit", "exfiltration", "data leak", "breach",
)


async def _check_threat_actor_news(client: httpx.AsyncClient, item: dict) -> list[dict[str, Any]]:
    """Search Google News RSS for new campaigns or intelligence reports on the threat actor."""
    alerts: list[dict[str, Any]] = []
    actor = item["value"]
    last = item.get("last_state") or {}
    seen_urls: set[str] = set(last.get("seen_news_urls", []))

    query = (
        f'"{actor}" '
        '(campaign OR attack OR malware OR ransomware OR espionage OR indictment '
        'OR sanctions OR "threat group" OR APT OR "zero-day" OR victims OR "data leak" OR breach)'
    )

    try:
        r = await client.get(
            _GNEWS_RSS,
            params={"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"},
            headers={"User-Agent": "SkillCTI/2.0 (+threat-intelligence-platform)"},
            follow_redirects=True,
            timeout=20,
        )
        if r.status_code != 200:
            return alerts

        parsed = feedparser.parse(r.text)
        new_articles: list[dict] = []

        for entry in parsed.entries[:25]:
            url = entry.get("link", "").strip()
            title = entry.get("title", "").strip()
            if not url or not title or url in seen_urls:
                continue
            seen_urls.add(url)
            text = (title + " " + entry.get("summary", "")).lower()
            if any(kw in text for kw in _ACTOR_ACTIVITY_KEYWORDS):
                new_articles.append({"title": title, "url": url})

        if new_articles:
            severity = "critical" if len(new_articles) >= 5 else "high" if len(new_articles) >= 2 else "medium"
            alerts.append({
                "alert_type": "actor_activity",
                "severity": severity,
                "title": f"{len(new_articles)} new report{'s' if len(new_articles) != 1 else ''} on {actor}",
                "detail": f"New intelligence reporting detected for threat actor {actor}.",
                "matches": new_articles,
            })

        item["last_state"] = {
            **(item.get("last_state") or {}),
            "seen_news_urls": list(seen_urls)[-500:],
        }

    except Exception as e:
        print(f"    Actor news check failed for {actor}: {e}")

    return alerts


async def _check_ransomware_victims(client: httpx.AsyncClient, item: dict) -> list[dict[str, Any]]:
    """Check ransomware.live for new victims posted by this ransomware group."""
    alerts: list[dict[str, Any]] = []
    actor = item["value"]
    last = item.get("last_state") or {}
    seen_victims: set[str] = set(last.get("seen_victims", []))

    slug = actor.lower().replace(" ", "-").replace("_", "-")

    try:
        r = await client.get(
            f"{_RANSOMWARE_LIVE}/victims/{slug}",
            headers={"User-Agent": "SkillCTI/2.0"},
            timeout=20,
        )
        if r.status_code != 200:
            return alerts

        data = r.json()
        victims = data if isinstance(data, list) else data.get("victims", [])

        new_victims: list[str] = []
        for v in victims[:20]:
            victim_id = v.get("victim", "") or v.get("name", "")
            if victim_id and victim_id not in seen_victims:
                seen_victims.add(victim_id)
                new_victims.append(victim_id)

        if new_victims:
            preview = ", ".join(new_victims[:5])
            if len(new_victims) > 5:
                preview += f" +{len(new_victims) - 5} more"
            alerts.append({
                "alert_type": "ransom_victim",
                "severity": "critical",
                "title": f"{actor} posted {len(new_victims)} new victim{'s' if len(new_victims) != 1 else ''}",
                "detail": f"New victim postings on ransomware.live: {preview}",
            })

        item["last_state"] = {
            **(item.get("last_state") or {}),
            "seen_victims": list(seen_victims)[-500:],
        }

    except Exception as e:
        print(f"    Ransomware.live check failed for {actor}: {e}")

    return alerts


async def _check_threat_actor(client: httpx.AsyncClient, item: dict) -> list[dict[str, Any]]:
    """Monitor a threat actor for new campaigns, intelligence reports, and ransomware victims."""
    alerts: list[dict[str, Any]] = []
    news_alerts = await _check_threat_actor_news(client, item)
    alerts.extend(news_alerts)
    victim_alerts = await _check_ransomware_victims(client, item)
    alerts.extend(victim_alerts)
    return alerts


# ── Main loop ──────────────────────────────────────────────────────────────────

async def run_checks() -> None:
    items = read_watchlist()
    if not items:
        return

    now = datetime.now(timezone.utc)
    updated = False

    async with httpx.AsyncClient(timeout=30) as client:
        for item in items:
            # Determine if due
            last_checked = item.get("last_checked")
            interval_hours = item.get("check_interval_hours", 12)
            if last_checked:
                try:
                    last_dt = datetime.fromisoformat(last_checked)
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=timezone.utc)
                    if (now - last_dt).total_seconds() < interval_hours * 3600:
                        continue
                except Exception:
                    pass

            print(f"  · watchlist checking: {item['value']} ({item['type']})")

            if item["type"] == "ioc":
                alert_dicts = await _check_ioc(client, item)
            elif item["type"] == "cve":
                alert_dicts = await _check_cve(client, item)
            elif item["type"] == "vendor":
                alert_dicts = await _check_vendor(client, item)
            elif item["type"] == "threat_actor":
                alert_dicts = await _check_threat_actor(client, item)
            else:
                alert_dicts = []

            for a in alert_dicts:
                create_alert(
                    item_id=item["id"],
                    item_value=item["value"],
                    item_type=item["type"],
                    **a,
                )
                print(f"    → alert: {a['title']}")

            item["last_checked"] = now.isoformat()
            updated = True
            await asyncio.sleep(1.5)  # rate-limit between items

    if updated:
        write_watchlist(items)


async def start_checker() -> None:
    """Startup background task — checks on boot then every hour."""
    await asyncio.sleep(15)  # let the server finish starting
    while True:
        try:
            await run_checks()
        except Exception as e:
            print(f"  · watchlist checker error: {e}")
        await asyncio.sleep(3600)
