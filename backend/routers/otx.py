"""
AlienVault OTX integration.
Endpoints: /otx/status, /otx/feed, /otx/pulse/{id}, /otx/search
Auth: X-OTX-API-KEY header. No extra library — raw httpx.
"""

import asyncio
import re
import time
from urllib.parse import quote

import httpx
from fastapi import APIRouter

from config import settings

router = APIRouter(prefix="/otx")

OTX_BASE = "https://otx.alienvault.com/api/v1"

_IP_RE     = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
_MD5_RE    = re.compile(r"^[a-fA-F0-9]{32}$")
_SHA1_RE   = re.compile(r"^[a-fA-F0-9]{40}$")
_SHA256_RE = re.compile(r"^[a-fA-F0-9]{64}$")

# In-memory caches
_status_cache: tuple[dict, float] | None = None
_feed_cache:   tuple[list, float] | None = None
_STATUS_TTL = 60
_FEED_TTL   = 300


def _headers() -> dict:
    return {"X-OTX-API-KEY": settings.otx_api_key}


def _detect_type(ioc: str) -> str:
    if _IP_RE.match(ioc):
        return "IPv4"
    if _SHA256_RE.match(ioc):
        return "file"
    if _SHA1_RE.match(ioc):
        return "file"
    if _MD5_RE.match(ioc):
        return "file"
    if ioc.startswith(("http://", "https://")):
        return "url"
    if "." in ioc and " " not in ioc and len(ioc) < 253:
        return "domain"
    return "unknown"


def _simplify_pulse(p: dict) -> dict:
    return {
        "id":                 p.get("id"),
        "name":               p.get("name", ""),
        "description":        (p.get("description") or "")[:200],
        "author":             p.get("author_name", ""),
        "created":            p.get("created", ""),
        "modified":           p.get("modified", ""),
        "tlp":                p.get("tlp", "white"),
        "ioc_count":          p.get("indicator_count", 0),
        "tags":               p.get("tags", [])[:6],
        "targeted_countries": p.get("targeted_countries", [])[:5],
        "industries":         p.get("industries", [])[:4],
        "attack_ids":         [a.get("display_name", "") for a in p.get("attack_ids", [])[:4]],
        "malware_families":   [m.get("display_name", "") for m in p.get("malware_families", [])[:4]],
        "references":         p.get("references", [])[:3],
    }


@router.get("/debug")
async def otx_debug():
    """Raw diagnostic — shows exactly what OTX returns for each endpoint."""
    if not settings.otx_api_key:
        return {"error": "otx_api_key is not set in .env / Settings"}

    key_preview = settings.otx_api_key[:6] + "..." + settings.otx_api_key[-4:]
    results: dict = {"key_preview": key_preview}

    async with httpx.AsyncClient(timeout=20) as client:
        for label, url, params in [
            ("user_me",            f"{OTX_BASE}/user/me",             {}),
            ("pulses_subscribed",  f"{OTX_BASE}/pulses/subscribed",   {"limit": 5, "page": 1}),
            ("pulses_activity",    f"{OTX_BASE}/pulses/activity",     {"limit": 5, "page": 1}),
            ("search_pulses",      f"{OTX_BASE}/search/pulses",       {"q": "malware", "limit": 5}),
        ]:
            try:
                r = await client.get(url, headers=_headers(), params=params)
                body = r.json()
                results[label] = {
                    "status_code": r.status_code,
                    "count": body.get("count"),
                    "results_len": len(body.get("results", [])),
                    "keys": list(body.keys()),
                    "first_result_name": body.get("results", [{}])[0].get("name") if body.get("results") else None,
                }
            except Exception as e:
                results[label] = {"error": str(e)}

    return results


@router.get("/status")
async def otx_status():
    global _status_cache
    if not settings.otx_api_key:
        return {"status": "no_key"}
    now = time.monotonic()
    if _status_cache and now - _status_cache[1] < _STATUS_TTL:
        return _status_cache[0]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{OTX_BASE}/user/me", headers=_headers())
            if r.status_code in (401, 403):
                return {"status": "bad_key"}
            r.raise_for_status()
            d = r.json()
            result = {
                "status":       "ok",
                "username":     d.get("username", ""),
                "pulse_count":  d.get("pulse_count", 0),
                "member_since": d.get("member_since", ""),
                "follower_count": d.get("follower_count", 0),
            }
            _status_cache = (result, now)
            return result
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


@router.get("/feed")
async def otx_feed(limit: int = 100, force: bool = False):
    global _feed_cache
    if not settings.otx_api_key:
        return {"status": "no_key", "pulses": []}
    if force:
        _feed_cache = None
    now = time.monotonic()
    if _feed_cache and now - _feed_cache[1] < _FEED_TTL:
        return {"status": "ok", "pulses": _feed_cache[0][:limit]}
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.get(
                f"{OTX_BASE}/pulses/activity",
                headers=_headers(),
                params={"limit": limit, "page": 1},
            )
        if r.status_code in (401, 403):
            return {"status": "bad_key", "pulses": []}
        r.raise_for_status()
        pulses = [_simplify_pulse(p) for p in r.json().get("results", [])]
        _feed_cache = (pulses, now)
        return {"status": "ok", "pulses": pulses}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200], "pulses": []}


@router.get("/pulse/{pulse_id}")
async def otx_pulse(pulse_id: str):
    if not settings.otx_api_key:
        return {"status": "no_key"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{OTX_BASE}/pulses/{pulse_id}", headers=_headers())
            if r.status_code == 404:
                return {"status": "not_found"}
            r.raise_for_status()
            p = r.json()
            # Return full pulse with indicator sample
            return {
                "status":       "ok",
                "pulse":        _simplify_pulse(p),
                "indicators":   p.get("indicators", [])[:50],
            }
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


@router.get("/search")
async def otx_search(ioc: str):
    if not settings.otx_api_key:
        return {"status": "no_key"}
    ioc = ioc.strip()
    if not ioc:
        return {"status": "error", "detail": "ioc required"}

    ioc_type = _detect_type(ioc)
    if ioc_type == "unknown":
        return {"status": "ok", "ioc_type": "unknown", "pulse_count": 0, "pulses": []}

    ioc_enc = quote(ioc, safe="") if ioc_type == "url" else ioc

    # Build URLs for general + an extra section in parallel
    if ioc_type == "IPv4":
        general_url = f"{OTX_BASE}/indicators/IPv4/{ioc_enc}/general"
        extra_url   = f"{OTX_BASE}/indicators/IPv4/{ioc_enc}/malware"
    elif ioc_type == "domain":
        general_url = f"{OTX_BASE}/indicators/domain/{ioc_enc}/general"
        extra_url   = f"{OTX_BASE}/indicators/domain/{ioc_enc}/malware"
    elif ioc_type == "file":
        general_url = f"{OTX_BASE}/indicators/file/{ioc_enc}/general"
        extra_url   = f"{OTX_BASE}/indicators/file/{ioc_enc}/analysis"
    else:
        general_url = f"{OTX_BASE}/indicators/url/{ioc_enc}/general"
        extra_url   = None

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            if extra_url:
                general_r, extra_r = await asyncio.gather(
                    client.get(general_url, headers=_headers()),
                    client.get(extra_url,   headers=_headers()),
                    return_exceptions=True,
                )
            else:
                general_r = await client.get(general_url, headers=_headers())
                extra_r = None

        if isinstance(general_r, Exception):
            return {"status": "error", "detail": str(general_r)[:200]}
        if general_r.status_code == 404:
            return {"status": "ok", "ioc_type": ioc_type, "pulse_count": 0, "pulses": [], "verdict": "unknown"}
        if general_r.status_code in (401, 403):
            return {"status": "bad_key"}
        general_r.raise_for_status()
        d = general_r.json()

        pulse_info = d.get("pulse_info", {})
        pulses     = pulse_info.get("pulses", [])[:10]
        count      = pulse_info.get("count", 0)
        otx_rep    = d.get("reputation", 0) or 0

        if count >= 3 or otx_rep < -1:
            verdict = "malicious"
        elif count >= 1 or otx_rep < 0:
            verdict = "suspicious"
        else:
            verdict = "unknown"

        result: dict = {
            "status":      "ok",
            "ioc_type":    ioc_type,
            "pulse_count": count,
            "verdict":     verdict,
            "reputation":  otx_rep,
            "pulses": [
                {
                    "id":               p.get("id"),
                    "name":             p.get("name", ""),
                    "author":           p.get("author_name", ""),
                    "created":          p.get("created", ""),
                    "tlp":              p.get("tlp", "white"),
                    "tags":             p.get("tags", [])[:4],
                    "malware_families": [m.get("display_name", "") for m in p.get("malware_families", [])[:3]],
                }
                for p in pulses
            ],
        }

        # Geo / ASN from general response
        if d.get("asn"):
            result["asn"] = d["asn"]
        if d.get("country_name"):
            result["country_name"] = d["country_name"]
        if d.get("city"):
            result["city"] = d["city"]

        # Extra section
        if extra_r and not isinstance(extra_r, Exception) and extra_r.status_code == 200:
            try:
                extra = extra_r.json()
                if ioc_type in ("IPv4", "domain"):
                    malware_data = extra.get("data", [])
                    result["malware_count"] = len(malware_data)
                    result["malware_samples"] = [
                        {
                            "hash":   m.get("hash", ""),
                            "name":   next(iter(m.get("detections", {}).values()), "") if m.get("detections") else "",
                            "date":   m.get("date", ""),
                        }
                        for m in malware_data[:8]
                    ]
                elif ioc_type == "file":
                    analysis = extra.get("analysis", {})
                    info = analysis.get("info", {}).get("results", {})
                    result["file_type"] = info.get("file_type", "")
                    result["file_size"] = info.get("file_size", 0)
                    plugins = analysis.get("plugins", {})
                    result["av_detections"] = sum(
                        1 for data in plugins.values()
                        if isinstance(data, dict) and data.get("results", {}).get("detection")
                    )
            except Exception:
                pass

        return result

    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}
