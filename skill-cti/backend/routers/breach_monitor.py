"""
Breach / Credential Monitoring via HaveIBeenPwned.

Free tier:  check if the organisation's own *service* appears in the known breach list.
Paid tier:  pass a HIBP API key (hibp_api_key in settings) to also query how many
            email addresses from the target domain appear in breach data.
"""
import logging
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

_HIBP_BASE = "https://haveibeenpwned.com/api/v3"
_HIBP_UA = "SkillCTI-BreachMonitor/1.0"

# Cache the full breach list for 1 hour — it changes infrequently
_breach_cache: list[dict] | None = None
_breach_cache_at: float = 0.0
_BREACH_TTL = 3600.0


def _clean_domain(raw: str) -> str:
    d = raw.strip().lower()
    for proto in ("https://", "http://"):
        if d.startswith(proto):
            d = d[len(proto):]
    return d.split("/")[0].split(":")[0].split("?")[0]


async def _all_breaches(client: httpx.AsyncClient) -> list[dict]:
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


async def _domain_credential_check(client: httpx.AsyncClient, domain: str) -> dict | None:
    """Requires a HIBP paid subscription (Pwned 1+)."""
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
        # Response is {email_alias: [breach_name, ...], ...}
        total_emails = len(data) if isinstance(data, dict) else 0
        total_exposures = sum(len(v) for v in data.values()) if isinstance(data, dict) else 0
        return {
            "found": total_emails > 0,
            "affected_emails": total_emails,
            "breach_exposures": total_exposures,
        }
    except Exception as e:
        logger.error("HIBP domain credential check failed for %s: %s", domain, e)
        return None


class BreachRequest(BaseModel):
    domain: str


@router.post("/breach-check")
async def breach_check(req: BreachRequest):
    domain = _clean_domain(req.domain)
    if not domain or "." not in domain:
        return {"error": "Invalid domain"}

    async with httpx.AsyncClient(timeout=35) as client:
        try:
            breaches = await _all_breaches(client)
        except Exception as e:
            logger.error("HIBP breach list fetch failed: %s", e)
            return {"error": "Could not fetch breach data — try again later"}

        cred_data = await _domain_credential_check(client, domain)

    # Breaches WHERE this organisation's service was the one compromised
    service_breaches = [
        {
            "name": b.get("Name", ""),
            "title": b.get("Title", ""),
            "domain": b.get("Domain", ""),
            "breach_date": b.get("BreachDate", ""),
            "added_date": (b.get("AddedDate") or "")[:10],
            "pwn_count": b.get("PwnCount", 0),
            "description": (b.get("Description") or "")[:400],
            "data_classes": b.get("DataClasses") or [],
            "is_verified": b.get("IsVerified", False),
            "is_sensitive": b.get("IsSensitive", False),
            "is_fabricated": b.get("IsFabricated", False),
        }
        for b in breaches
        if b.get("Domain", "").lower() == domain
    ]
    service_breaches.sort(key=lambda x: x["breach_date"], reverse=True)

    return {
        "domain": domain,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "service_breach_count": len(service_breaches),
        "service_breaches": service_breaches,
        "total_accounts_exposed": sum(b["pwn_count"] for b in service_breaches),
        "total_known_breaches_checked": len(breaches),
        "hibp_key_configured": bool(settings.hibp_api_key),
        "credential_data": cred_data,
    }
