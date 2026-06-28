import logging
import time
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter()

RANSOMWATCH_URL = "https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json"

# Simple in-memory cache: (data, fetched_at)
_cache: tuple[list, float] | None = None
_CACHE_TTL = 1800  # 30 minutes


def _parse_date(s: str) -> datetime:
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:26], fmt[:len(fmt)])
        except ValueError:
            continue
    return datetime.min


async def _fetch_posts() -> list:
    global _cache
    now = time.monotonic()
    if _cache and now - _cache[1] < _CACHE_TTL:
        return _cache[0]

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(RANSOMWATCH_URL, headers={"User-Agent": "skillcti-dashboard/1.0"})
        resp.raise_for_status()
        posts = resp.json()

    _cache = (posts, now)
    return posts


@router.get("/ransomware-feed")
async def ransomware_feed(days: int = 30):
    try:
        posts = await _fetch_posts()
    except Exception as e:
        logger.error("Ransomwatch fetch failed: %s", e)
        raise HTTPException(502, "Ransomware feed unavailable — try again later")

    cutoff = datetime.utcnow() - timedelta(days=days)
    recent = [p for p in posts if _parse_date(p.get("discovered", "")) >= cutoff]

    groups: dict[str, dict] = {}
    for p in recent:
        g = p.get("group_name", "unknown").lower()
        title = p.get("post_title", "Unknown")
        disc = p.get("discovered", "")
        if g not in groups:
            groups[g] = {"group_name": g, "count": 0, "latest_victim": title, "latest_date": disc}
        groups[g]["count"] += 1
        if disc > groups[g]["latest_date"]:
            groups[g]["latest_date"] = disc
            groups[g]["latest_victim"] = title

    top = sorted(groups.values(), key=lambda x: x["count"], reverse=True)[:8]
    return {"groups": top, "total_recent": len(recent), "period_days": days}


# Keep old endpoint redirecting to new one for backward compat
@router.get("/ransomware-au")
async def ransomware_au():
    return await ransomware_feed(days=30)
