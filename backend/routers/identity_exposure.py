"""
Identity & Credential Exposure monitoring.

Combines four sources into one unified response:
  - HIBP (Have I Been Pwned)   — known breach databases + domain credential counts
  - HudsonRock Cavalier         — infostealer / stealer log hits (free, no key)
  - LeakIX                      — leaked data exposure events (free tier)
  - IntelX                      — dark web search (requires INTELX_API_KEY)

Accepts a domain (example.com) or an email address (user@example.com).
"""
import asyncio
import logging
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

_HIBP_BASE = "https://haveibeenpwned.com/api/v3"
_HIBP_UA   = "SkillCTI-IdentityExposure/1.0"
_HR_BASE   = "https://cavalier.hudsonrock.com/api/json/v2/osint-tools"
_LEAKIX    = "https://leakix.net"
_INTELX    = "https://2.intelx.io"

# Cache the full HIBP breach list — it rarely changes
_breach_cache: list[dict] | None = None
_breach_cache_at: float = 0.0
_BREACH_TTL = 3600.0


# ── helpers ──────────────────────────────────────────────────────────────────

def _clean_domain(raw: str) -> str:
    d = raw.strip().lower()
    for proto in ("https://", "http://"):
        if d.startswith(proto):
            d = d[len(proto):]
    return d.split("/")[0].split(":")[0].split("?")[0]


def _is_email(query: str) -> bool:
    return "@" in query and "." in query.split("@")[-1]


def _risk_level(breaches: int, stealers: int) -> str:
    score = breaches * 2 + stealers * 5
    if score >= 15:
        return "critical"
    if score >= 8:
        return "high"
    if score >= 3:
        return "medium"
    if score >= 1:
        return "low"
    return "none"


# ── HIBP ─────────────────────────────────────────────────────────────────────

async def _hibp_all_breaches(client: httpx.AsyncClient) -> list[dict]:
    global _breach_cache, _breach_cache_at
    now = time.monotonic()
    if _breach_cache is not None and now - _breach_cache_at < _BREACH_TTL:
        return _breach_cache
    headers: dict[str, str] = {"User-Agent": _HIBP_UA}
    if settings.hibp_api_key:
        headers["hibp-api-key"] = settings.hibp_api_key
    r = await client.get(f"{_HIBP_BASE}/breaches", headers=headers, timeout=30)
    r.raise_for_status()
    _breach_cache = r.json()
    _breach_cache_at = now
    return _breach_cache  # type: ignore[return-value]


async def _hibp_domain_creds(client: httpx.AsyncClient, domain: str) -> dict | None:
    if not settings.hibp_api_key:
        return None
    try:
        r = await client.get(
            f"{_HIBP_BASE}/breacheddomain/{domain}",
            headers={"User-Agent": _HIBP_UA, "hibp-api-key": settings.hibp_api_key},
            timeout=30,
        )
        if r.status_code == 404:
            return {"found": False, "affected_emails": 0, "breach_exposures": 0}
        if r.status_code == 402:
            return {"requires_paid_plan": True}
        if r.status_code == 401:
            return {"bad_key": True}
        r.raise_for_status()
        data = r.json()
        total_emails    = len(data) if isinstance(data, dict) else 0
        total_exposures = sum(len(v) for v in data.values()) if isinstance(data, dict) else 0
        return {
            "found":           total_emails > 0,
            "affected_emails": total_emails,
            "breach_exposures": total_exposures,
            "by_alias":        data if isinstance(data, dict) else {},
        }
    except Exception as e:
        logger.error("HIBP domain credential check failed for %s: %s", domain, e)
        return None


async def _hibp_email_breaches(client: httpx.AsyncClient, email: str) -> list[dict]:
    if not settings.hibp_api_key:
        return []
    try:
        r = await client.get(
            f"{_HIBP_BASE}/breachedaccount/{email}",
            headers={"User-Agent": _HIBP_UA, "hibp-api-key": settings.hibp_api_key},
            params={"truncateResponse": "false"},
            timeout=30,
        )
        if r.status_code == 404:
            return []
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.error("HIBP email breach check failed for %s: %s", email, e)
        return []


# ── HudsonRock Cavalier ───────────────────────────────────────────────────────

async def _hudsonrock(client: httpx.AsyncClient, query: str, by_email: bool) -> dict:
    try:
        endpoint = "search-by-email" if by_email else "search-by-domain"
        param    = "email" if by_email else "domain"
        r = await client.get(
            f"{_HR_BASE}/{endpoint}",
            params={param: query},
            headers={"User-Agent": "SkillCTI/1.0"},
            timeout=20,
        )
        if r.status_code == 200:
            return {"ok": True, "data": r.json()}
        return {"ok": False, "error": f"HTTP {r.status_code}"}
    except Exception as e:
        logger.warning("HudsonRock lookup failed for %s: %s", query, e)
        return {"ok": False, "error": str(e)}


# ── LeakIX ───────────────────────────────────────────────────────────────────

async def _leakix(client: httpx.AsyncClient, domain: str) -> dict:
    try:
        r = await client.get(
            f"{_LEAKIX}/domain/{domain}",
            headers={"Accept": "application/json", "User-Agent": "SkillCTI/1.0"},
            timeout=20,
        )
        if r.status_code == 200:
            data = r.json()
            return {"ok": True, "data": data if isinstance(data, list) else [data]}
        if r.status_code == 404:
            return {"ok": True, "data": []}
        return {"ok": False, "error": f"HTTP {r.status_code}"}
    except Exception as e:
        logger.warning("LeakIX lookup failed for %s: %s", domain, e)
        return {"ok": False, "error": str(e)}


# ── IntelX ───────────────────────────────────────────────────────────────────

async def _intelx(client: httpx.AsyncClient, query: str) -> dict:
    if not settings.intelx_api_key:
        return {"ok": False, "error": "not_configured"}
    try:
        search_r = await client.post(
            f"{_INTELX}/intelligent/search",
            json={
                "term": query, "buckets": [], "lookuplevel": 0,
                "maxresults": 10, "timeout": 0,
                "datefrom": "", "dateto": "", "sort": 2, "media": 0, "terminate": [],
            },
            headers={"x-key": settings.intelx_api_key, "User-Agent": "SkillCTI/1.0"},
            timeout=20,
        )
        if search_r.status_code != 200:
            return {"ok": False, "error": f"HTTP {search_r.status_code}"}
        search_id = search_r.json().get("id", "")
        if not search_id:
            return {"ok": True, "data": []}
        results_r = await client.get(
            f"{_INTELX}/intelligent/search/result",
            params={"id": search_id, "limit": 10},
            headers={"x-key": settings.intelx_api_key, "User-Agent": "SkillCTI/1.0"},
            timeout=20,
        )
        if results_r.status_code != 200:
            return {"ok": True, "data": []}
        return {"ok": True, "data": results_r.json().get("records", [])}
    except Exception as e:
        logger.warning("IntelX search failed for %s: %s", query, e)
        return {"ok": False, "error": str(e)}


# ── endpoint ─────────────────────────────────────────────────────────────────

class ExposureRequest(BaseModel):
    query: str


@router.post("/identity-exposure")
async def identity_exposure(req: ExposureRequest):
    query    = req.query.strip()
    is_email = _is_email(query)
    domain   = query.split("@")[-1] if is_email else _clean_domain(query)

    if not query or (not is_email and "." not in domain):
        return {"error": "Enter a valid domain or email address"}

    async with httpx.AsyncClient(timeout=35) as client:
        if is_email:
            raw = await asyncio.gather(
                _hibp_email_breaches(client, query),
                _hudsonrock(client, query, by_email=True),
                _intelx(client, query),
                return_exceptions=True,
            )
            hibp_email_breaches, hr_raw, intelx_raw = raw
            hibp_all_breaches = []
            hibp_creds_raw    = None
            leakix_raw        = {"ok": False, "error": "not_searched"}
        else:
            raw = await asyncio.gather(
                _hibp_all_breaches(client),
                _hibp_domain_creds(client, domain),
                _hudsonrock(client, domain, by_email=False),
                _leakix(client, domain),
                _intelx(client, query),
                return_exceptions=True,
            )
            hibp_all_breaches, hibp_creds_raw, hr_raw, leakix_raw, intelx_raw = raw
            hibp_email_breaches = []

    # ── normalise exceptions ──────────────────────────────────────────────────

    if isinstance(hibp_all_breaches, Exception):
        hibp_all_breaches = []
    if isinstance(hibp_email_breaches, Exception):
        hibp_email_breaches = []
    if isinstance(hibp_creds_raw, Exception):
        hibp_creds_raw = None
    if isinstance(hr_raw, Exception):
        hr_raw = {"ok": False, "error": str(hr_raw)}
    if isinstance(leakix_raw, Exception):
        leakix_raw = {"ok": False, "error": str(leakix_raw)}
    if isinstance(intelx_raw, Exception):
        intelx_raw = {"ok": False, "error": str(intelx_raw)}

    # ── HIBP section ──────────────────────────────────────────────────────────

    if is_email:
        service_breaches = []
        email_breaches   = hibp_email_breaches if isinstance(hibp_email_breaches, list) else []
    else:
        all_b = hibp_all_breaches if isinstance(hibp_all_breaches, list) else []
        service_breaches = [
            {
                "name":        b.get("Name", ""),
                "title":       b.get("Title", ""),
                "domain":      b.get("Domain", ""),
                "breach_date": b.get("BreachDate", ""),
                "added_date":  (b.get("AddedDate") or "")[:10],
                "pwn_count":   b.get("PwnCount", 0),
                "description": (b.get("Description") or "")[:400],
                "data_classes": b.get("DataClasses") or [],
                "is_verified": b.get("IsVerified", False),
                "logo_path":   b.get("LogoPath", ""),
            }
            for b in all_b
            if b.get("Domain", "").lower() == domain
        ]
        service_breaches.sort(key=lambda x: x["breach_date"], reverse=True)
        email_breaches = []

    hibp_section = {
        "configured":      bool(settings.hibp_api_key),
        "service_breaches": service_breaches,
        "email_breaches":  email_breaches,
        "credential_data": hibp_creds_raw,
    }

    # ── HudsonRock section ────────────────────────────────────────────────────

    hr_ok   = hr_raw.get("ok", False) if isinstance(hr_raw, dict) else False
    hr_data = hr_raw.get("data") if hr_ok else None

    if hr_ok and isinstance(hr_data, dict):
        # Free-tier /search-by-domain returns an aggregate overview, not per-machine records.
        # Individual stealer entries (computer_name, OS, etc.) are only in paid tiers.
        total_stealers = int(hr_data.get("total") or 0)
        employees_raw  = hr_data.get("employees", 0)
        employees_compromised = (
            employees_raw if isinstance(employees_raw, int)
            else len(employees_raw) if isinstance(employees_raw, list)
            else 0
        )
        stealer_families = hr_data.get("stealerFamilies") or {}
        last_compromised = (
            hr_data.get("last_employee_compromised") or
            hr_data.get("last_user_compromised") or ""
        )
        inner = hr_data.get("data") or {}
        employees_urls = inner.get("employees_urls", []) if isinstance(inner, dict) else []
        users_urls     = inner.get("clients_urls", []) if isinstance(inner, dict) else []
        stealers = []
    elif hr_ok and isinstance(hr_data, list):
        # Email search returns a list of individual stealer records
        stealers = hr_data
        total_stealers = len(stealers)
        employees_compromised = sum(
            len(s.get("employees", [])) for s in stealers if isinstance(s, dict)
        )
        stealer_families = {}
        last_compromised = ""
        employees_urls = []
        users_urls = []
    else:
        stealers = []
        total_stealers = 0
        employees_compromised = 0
        stealer_families = {}
        last_compromised = ""
        employees_urls = []
        users_urls = []

    hr_section = {
        "ok":                    hr_ok,
        "error":                 hr_raw.get("error") if isinstance(hr_raw, dict) else None,
        "stealers":              stealers,
        "total":                 total_stealers,
        "employees_compromised": employees_compromised,
        "stealer_families":      stealer_families,
        "last_compromised":      last_compromised,
        "employees_urls":        employees_urls,
        "users_urls":            users_urls,
    }

    # ── LeakIX section ────────────────────────────────────────────────────────

    leakix_section = {
        "ok":     leakix_raw.get("ok", False) if isinstance(leakix_raw, dict) else False,
        "error":  leakix_raw.get("error") if isinstance(leakix_raw, dict) else None,
        "events": leakix_raw.get("data", []) if isinstance(leakix_raw, dict) and leakix_raw.get("ok") else [],
    }

    # ── IntelX section ────────────────────────────────────────────────────────

    intelx_section = {
        "configured": bool(settings.intelx_api_key),
        "ok":         intelx_raw.get("ok", False) if isinstance(intelx_raw, dict) else False,
        "error":      intelx_raw.get("error") if isinstance(intelx_raw, dict) else None,
        "results":    intelx_raw.get("data", []) if isinstance(intelx_raw, dict) and intelx_raw.get("ok") else [],
    }

    # ── summary ───────────────────────────────────────────────────────────────

    breach_count  = len(service_breaches) + len(email_breaches)
    stealer_count = total_stealers

    return {
        "query":      query,
        "query_type": "email" if is_email else "domain",
        "domain":     domain,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_breaches":         breach_count,
            "total_stealer_hits":     stealer_count,
            "employees_compromised":  employees_compromised,
            "leakix_events":          len(leakix_section["events"]),
            "intelx_results":         len(intelx_section["results"]),
            "risk_level":             _risk_level(breach_count, stealer_count),
        },
        "hibp":       hibp_section,
        "hudsonrock": hr_section,
        "leakix":     leakix_section,
        "intelx":     intelx_section,
    }
