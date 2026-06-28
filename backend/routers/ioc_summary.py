"""
IOC AI Summary — generates a concise analyst triage summary for an enriched IOC.
Uses Haiku for low latency and cost.
"""

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

_ANTHROPIC_API = "https://api.anthropic.com"
_MODEL = "claude-haiku-4-5-20251001"

_SYSTEM = (
    "You are a SOC analyst writing a triage note for an indicator of compromise. "
    "Given enrichment data, write exactly 2-3 sentences covering: "
    "(1) what the indicator is and its overall threat classification, "
    "(2) the key evidence — mention specific malware families, scores, or detection counts by name, "
    "(3) the recommended analyst action (e.g. block at perimeter, escalate, monitor, or mark benign). "
    "Be specific and reference actual source findings. "
    "Plain English only — no markdown, no bullet points, no headers. Keep it under 80 words."
)


class IocSummaryRequest(BaseModel):
    enrich: dict[str, Any]
    malware_intel: dict[str, Any] | None = None


def _build_context(req: IocSummaryRequest) -> str:
    e = req.enrich
    ioc = e.get("ioc", "unknown")
    ioc_type = e.get("type", "unknown")
    verdict = e.get("verdict", "unknown")
    sources: dict = e.get("sources", {})

    lines = [
        f"IOC: {ioc}",
        f"Type: {ioc_type}",
        f"Overall verdict: {verdict}",
        "",
    ]

    # VirusTotal
    vt = sources.get("virustotal", {})
    if vt.get("status") == "ok":
        mal = vt.get("malicious", 0)
        susp = vt.get("suspicious", 0)
        total = vt.get("total", 0)
        lines.append(f"VirusTotal: {mal}/{total} engines malicious, {susp} suspicious")
        if vt.get("categories"):
            lines.append(f"  Categories: {', '.join(vt['categories'][:5])}")
        if vt.get("as_owner"):
            lines.append(f"  Network: {vt['as_owner']}" + (f", {vt['country']}" if vt.get("country") else ""))

    # AbuseIPDB
    abuse = sources.get("abuseipdb", {})
    if abuse.get("status") == "ok":
        lines.append(
            f"AbuseIPDB: {abuse.get('score', 0)}% abuse confidence, "
            f"{abuse.get('total_reports', 0)} reports"
            + (" (TOR exit node)" if abuse.get("is_tor") else "")
        )
        if abuse.get("isp"):
            lines.append(f"  ISP: {abuse['isp']}" + (f", {abuse['country']}" if abuse.get("country") else ""))
        if abuse.get("usage_type"):
            lines.append(f"  Usage type: {abuse['usage_type']}")

    # urlscan
    urlscan = sources.get("urlscan", {})
    if urlscan.get("status") == "ok":
        tags = ", ".join(urlscan["tags"][:5]) if urlscan.get("tags") else "none"
        lines.append(f"urlscan: verdict={urlscan.get('verdict', 'unknown')}, tags={tags}")

    # ThreatFox
    tf = sources.get("threatfox", {})
    if tf.get("status") == "ok" and tf.get("verdict") not in (None, "unknown"):
        lines.append(
            f"ThreatFox: malware={tf.get('malware', 'unknown')}, "
            f"type={tf.get('threat_type', 'unknown')}, "
            f"confidence={tf.get('confidence', 0)}%"
            + (f", first seen {tf['first_seen']}" if tf.get("first_seen") else "")
        )

    # MalwareBazaar source block
    mb_src = sources.get("malwarebazaar", {})
    if mb_src.get("status") == "ok":
        lines.append(
            f"MalwareBazaar: signature={mb_src.get('signature', 'unknown')}, "
            f"type={mb_src.get('file_type', 'unknown')}"
        )
        if mb_src.get("tags"):
            lines.append(f"  Tags: {', '.join(mb_src['tags'][:5])}")

    # OTX
    otx = sources.get("otx", {})
    if otx.get("status") == "ok":
        pulses = otx.get("pulse_count", 0)
        lines.append(f"OTX AlienVault: {pulses} community pulse{'s' if pulses != 1 else ''}")
        if otx.get("malware_families"):
            lines.append(f"  Malware families: {', '.join(otx['malware_families'][:5])}")
        if otx.get("malware_count", 0) > 0:
            lines.append(f"  Associated malware samples: {otx['malware_count']}")

    # Shodan
    shodan = sources.get("shodan", {})
    if shodan.get("status") == "ok":
        if shodan.get("ports"):
            lines.append(f"Shodan: ports={', '.join(str(p) for p in shodan['ports'][:8])}")
        if shodan.get("services"):
            lines.append(f"  Services: {', '.join(shodan['services'][:5])}")
        if shodan.get("org"):
            lines.append(f"  Org: {shodan['org']}")
        if shodan.get("os"):
            lines.append(f"  OS: {shodan['os']}")

    # Deep malware intel (hashes only)
    mi = req.malware_intel
    if mi and not mi.get("error"):
        vt_mi = mi.get("virustotal", {})
        if vt_mi.get("status") == "ok":
            if vt_mi.get("popular_threat_name"):
                lines.append(f"VT threat classification: {vt_mi['popular_threat_name']}")
            if vt_mi.get("sandbox_verdicts"):
                sv = [f"{s['sandbox']}={s['verdict']}" for s in vt_mi["sandbox_verdicts"][:3]]
                lines.append(f"  Sandbox: {', '.join(sv)}")
            if vt_mi.get("contacted_ips"):
                lines.append(f"  C2 IPs contacted: {', '.join(vt_mi['contacted_ips'][:5])}")
            if vt_mi.get("contacted_domains"):
                lines.append(f"  C2 domains contacted: {', '.join(vt_mi['contacted_domains'][:5])}")

        mb_mi = mi.get("malwarebazaar", {})
        if mb_mi.get("status") == "ok":
            if mb_mi.get("delivery_method"):
                lines.append(f"MalwareBazaar delivery: {mb_mi['delivery_method']}")
            if mb_mi.get("c2"):
                lines.append(f"  C2 URLs: {', '.join(mb_mi['c2'][:3])}")

        ha = mi.get("hybrid_analysis", {})
        if ha.get("status") == "ok":
            lines.append(
                f"Hybrid Analysis: threat score={ha.get('threat_score', 0)}/100"
                + (f", family={ha['malware_family']}" if ha.get("malware_family") else "")
            )
            if ha.get("mitre_attcks"):
                ids = [m.get("id", "") for m in ha["mitre_attcks"][:6]]
                lines.append(f"  MITRE ATT&CK: {', '.join(ids)}")

    return "\n".join(lines)


@router.post("/ioc-summary")
async def ioc_summary(req: IocSummaryRequest):
    if not settings.anthropic_api_key:
        raise HTTPException(400, "ANTHROPIC_API_KEY not configured — set it in Settings")

    context = _build_context(req)

    headers = {
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "x-api-key": settings.anthropic_api_key,
    }
    body = {
        "model": _MODEL,
        "max_tokens": 256,
        "system": _SYSTEM,
        "messages": [{"role": "user", "content": f"Summarise this IOC:\n\n{context}"}],
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{_ANTHROPIC_API}/v1/messages", json=body, headers=headers)
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.error("ioc-summary: Anthropic HTTP %s", e.response.status_code)
        raise HTTPException(502, "Upstream API error — try again")
    except Exception as e:
        logger.error("ioc-summary: request failed: %s", e)
        raise HTTPException(500, "Summary generation failed")

    resp_data = resp.json()

    usage = resp_data.get("usage", {})
    try:
        from services.api_spend import record_spend
        record_spend(
            "ioc-summary",
            _MODEL,
            usage.get("input_tokens", 0),
            usage.get("output_tokens", 0),
            usage.get("cache_read_input_tokens", 0),
            usage.get("cache_creation_input_tokens", 0),
        )
    except Exception:
        pass

    summary = "".join(
        block.get("text", "")
        for block in resp_data.get("content", [])
        if block.get("type") == "text"
    ).strip()

    return {"summary": summary}
