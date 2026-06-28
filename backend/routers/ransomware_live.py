"""Proxy + filter layer for data.ransomware.live.

Downloads victims.json and groups.json from data.ransomware.live,
caches them in memory for 15 minutes, then serves filtered subsets
so the browser never has to deal with CORS or a 19 MB payload.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter(prefix="/api/ransomware-live", tags=["ransomware-live"])

_DATA_BASE = "https://data.ransomware.live"
_TIMEOUT   = 60.0
_TTL       = 900  # 15-minute cache

# ── In-memory cache ───────────────────────────────────────────────────────────

_victims:            list[dict[str, Any]] | None = None
_victims_fetched_at: float = 0

_groups:            list[dict[str, Any]] | None = None
_groups_fetched_at: float = 0


async def _load_victims() -> list[dict[str, Any]]:
    global _victims, _victims_fetched_at
    if _victims is not None and (time.time() - _victims_fetched_at) < _TTL:
        return _victims
    async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as c:
        resp = await c.get(f"{_DATA_BASE}/victims.json")
    if not resp.is_success:
        raise HTTPException(502, f"data.ransomware.live/victims.json → {resp.status_code}")
    _victims = resp.json()
    _victims_fetched_at = time.time()
    return _victims


async def _load_groups() -> list[dict[str, Any]]:
    global _groups, _groups_fetched_at
    if _groups is not None and (time.time() - _groups_fetched_at) < _TTL:
        return _groups
    async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as c:
        resp = await c.get(f"{_DATA_BASE}/groups.json")
    if not resp.is_success:
        raise HTTPException(502, f"data.ransomware.live/groups.json → {resp.status_code}")
    _groups = resp.json()
    _groups_fetched_at = time.time()
    return _groups


def _json_resp(data: Any) -> Response:
    return Response(content=json.dumps(data), media_type="application/json")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _days_ago(iso: str | None, n: int) -> bool:
    """Return True if the ISO timestamp is within the last n days."""
    if not iso:
        return False
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return (datetime.now(tz=timezone.utc) - dt).days <= n
    except Exception:
        return False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/recentvictims")
async def recent_victims() -> Response:
    """Return the 100 most recently discovered victims."""
    victims = await _load_victims()
    return _json_resp(victims[:100])


@router.get("/groups")
async def groups() -> Response:
    """Return all groups, augmented with online status derived from victims."""
    grps    = await _load_groups()
    victims = await _load_victims()

    # Build last-seen map from victims (newest entry wins)
    last_seen: dict[str, str] = {}
    for v in victims:
        gn = v.get("group_name") or ""
        discovered = v.get("discovered") or ""
        if gn and discovered:
            if gn not in last_seen or discovered > last_seen[gn]:
                last_seen[gn] = discovered

    result = []
    for g in grps:
        name = g.get("name") or ""
        lv   = last_seen.get(name)
        result.append({
            "name":         name,
            "description":  g.get("description") or "",
            "status":       "online" if _days_ago(lv, 90) else "offline",
            "victims":      g.get("_victim_count") or 0,
            "added":        g.get("date") or "",
            "last_victim":  lv or "",
        })

    return _json_resp(result)


@router.get("/groupvictims/{group_name}")
async def group_victims(group_name: str) -> Response:
    victims = await _load_victims()
    q = group_name.lower()
    filtered = [v for v in victims if (v.get("group_name") or "").lower() == q]
    return _json_resp(filtered)


@router.get("/searchvictims/{keyword}")
async def search_victims(keyword: str) -> Response:
    victims = await _load_victims()
    q = keyword.lower()
    filtered = [
        v for v in victims
        if q in (v.get("post_title") or "").lower()
        or q in (v.get("website") or "").lower()
        or q in (v.get("description") or "").lower()
    ]
    return _json_resp(filtered)


@router.get("/countryvictims/{code}")
async def country_victims(code: str) -> Response:
    victims = await _load_victims()
    q = code.upper()
    filtered = [v for v in victims if (v.get("country") or "").upper() == q]
    return _json_resp(filtered)


@router.get("/sectorvictims/{sector}")
async def sector_victims(sector: str) -> Response:
    victims = await _load_victims()
    q = sector.lower()
    filtered = [v for v in victims if (v.get("activity") or "").lower() == q]
    return _json_resp(filtered)


@router.get("/victims/{year}/{month}")
async def victims_by_month(year: int, month: int) -> Response:
    victims = await _load_victims()
    prefix = f"{year}-{month:02d}"
    filtered = [v for v in victims if (v.get("discovered") or "").startswith(prefix)]
    return _json_resp(filtered)
