"""
Abuse.ch feed integrations — MalwareBazaar, URLhaus, ThreatFox recent IOCs.
All free; no API key required (ThreatFox key improves rate limits if present).
"""

import time

import httpx
from fastapi import APIRouter

from config import settings

router = APIRouter(prefix="/abuse")

_TTL = 300  # 5-minute cache for all feeds

_mb_cache:  tuple[list, float] | None = None
_uh_cache:  tuple[list, float] | None = None
_tf_cache:  tuple[list, float] | None = None


# ── MalwareBazaar ─────────────────────────────────────────────────────────────

@router.get("/malwarebazaar")
async def malwarebazaar_recent(limit: int = 25, force: bool = False):
    global _mb_cache
    if force:
        _mb_cache = None
    now = time.monotonic()
    if _mb_cache and now - _mb_cache[1] < _TTL:
        return {"status": "ok", "samples": _mb_cache[0][:limit]}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                "https://mb-api.abuse.ch/api/v1/",
                data={"query": "get_recent", "selector": "time"},
                headers={"User-Agent": "SkillCTI/1.0"},
            )
            r.raise_for_status()
            body = r.json()
        if body.get("query_status") != "ok":
            return {"status": "error", "detail": body.get("query_status", "unknown"), "samples": []}
        samples = [
            {
                "sha256":          s.get("sha256_hash", ""),
                "md5":             s.get("md5_hash", ""),
                "file_name":       s.get("file_name") or "",
                "file_type":       s.get("file_type") or "",
                "file_size":       s.get("file_size", 0),
                "signature":       s.get("signature") or "",
                "tags":            s.get("tags") or [],
                "first_seen":      s.get("first_seen", ""),
                "reporter":        s.get("reporter", ""),
                "origin_country":  s.get("origin_country") or "",
                "delivery_method": s.get("delivery_method") or "",
            }
            for s in body.get("data", [])[:limit]
        ]
        _mb_cache = (samples, now)
        return {"status": "ok", "samples": samples}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200], "samples": []}


# ── URLhaus ───────────────────────────────────────────────────────────────────

@router.get("/urlhaus")
async def urlhaus_recent(limit: int = 25, force: bool = False):
    global _uh_cache
    if force:
        _uh_cache = None
    now = time.monotonic()
    if _uh_cache and now - _uh_cache[1] < _TTL:
        return {"status": "ok", "urls": _uh_cache[0][:limit]}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                "https://urlhaus-api.abuse.ch/v1/urls/recent/",
                headers={"User-Agent": "SkillCTI/1.0"},
            )
            r.raise_for_status()
            body = r.json()
        if body.get("query_status") != "ok":
            return {"status": "error", "detail": body.get("query_status", "unknown"), "urls": []}
        urls = [
            {
                "id":           u.get("id", ""),
                "url":          u.get("url", ""),
                "url_status":   u.get("url_status", ""),
                "host":         u.get("host", ""),
                "threat":       u.get("threat", ""),
                "tags":         u.get("tags") or [],
                "date_added":   u.get("date_added", ""),
                "reporter":     u.get("reporter", ""),
                "country_code": u.get("country_code") or "",
            }
            for u in body.get("urls", [])[:limit]
        ]
        _uh_cache = (urls, now)
        return {"status": "ok", "urls": urls}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200], "urls": []}


# ── ThreatFox recent IOCs ─────────────────────────────────────────────────────

@router.get("/threatfox")
async def threatfox_recent(days: int = 1, limit: int = 30, force: bool = False):
    global _tf_cache
    if force:
        _tf_cache = None
    now = time.monotonic()
    if _tf_cache and now - _tf_cache[1] < _TTL:
        return {"status": "ok", "iocs": _tf_cache[0][:limit]}
    try:
        headers: dict = {"User-Agent": "SkillCTI/1.0"}
        if settings.threatfox_api_key:
            headers["API-KEY"] = settings.threatfox_api_key
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                "https://threatfox-api.abuse.ch/api/v1/",
                json={"query": "get_iocs", "days": days},
                headers=headers,
            )
            r.raise_for_status()
            body = r.json()
        status = body.get("query_status", "")
        if status not in ("ok", "no_result"):
            return {"status": "error", "detail": status, "iocs": []}
        iocs = [
            {
                "id":            i.get("id", ""),
                "ioc":           i.get("ioc", ""),
                "ioc_type":      i.get("ioc_type", ""),
                "threat_type":   i.get("threat_type", ""),
                "malware":       i.get("malware", ""),
                "malware_alias": i.get("malware_alias") or "",
                "confidence":    i.get("confidence_level", 0),
                "first_seen":    i.get("first_seen", ""),
                "reporter":      i.get("reporter", ""),
                "tags":          i.get("tags") or [],
            }
            for i in (body.get("data") or [])[:limit]
        ]
        _tf_cache = (iocs, now)
        return {"status": "ok", "iocs": iocs}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200], "iocs": []}
