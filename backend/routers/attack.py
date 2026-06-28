"""MITRE ATT&CK API router."""
from __future__ import annotations

import asyncio
import logging

import httpx
from fastapi import APIRouter, HTTPException

from services.attack import (
    get_status, is_stale, get_tactics, get_techniques,
    get_technique_detail, get_groups, get_group_detail, load_bundle,
)

router = APIRouter(prefix="/api/attack", tags=["attack"])
logger = logging.getLogger(__name__)

_BUNDLE_URL = (
    "https://raw.githubusercontent.com/mitre/cti/master/"
    "enterprise-attack/enterprise-attack.json"
)
_loading = False


async def _do_load() -> None:
    global _loading
    if _loading:
        return
    _loading = True
    try:
        logger.info("Fetching MITRE ATT&CK STIX bundle (~20 MB)…")
        async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
            resp = await client.get(_BUNDLE_URL, headers={"User-Agent": "SkillCTI/2.0"})
            resp.raise_for_status()
            text = resp.text
        await asyncio.to_thread(load_bundle, text)
        logger.info("ATT&CK data refresh complete")
    except Exception as e:
        logger.error("ATT&CK refresh failed: %s", e)
    finally:
        _loading = False


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
async def status():
    s = get_status()
    s["is_loading"] = _loading
    return s


@router.get("/tactics")
async def tactics():
    try:
        return {"tactics": get_tactics()}
    except Exception as e:
        logger.error("Get tactics failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to retrieve tactics — check server logs")


@router.get("/techniques")
async def techniques(tactic: str = "", q: str = "", limit: int = 300, offset: int = 0):
    try:
        result = get_techniques(
            tactic=tactic or None,
            q=q or None,
            limit=min(limit, 500),
            offset=offset,
        )
        return {"techniques": result, "total": len(result)}
    except Exception as e:
        logger.error("Get techniques failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to retrieve techniques — check server logs")


@router.get("/techniques/{attack_id}")
async def technique_detail(attack_id: str):
    detail = get_technique_detail(attack_id.upper())
    if not detail:
        raise HTTPException(404, f"Technique {attack_id} not found")
    return detail


@router.get("/groups")
async def groups(q: str = ""):
    try:
        return {"groups": get_groups(q=q or None)}
    except Exception as e:
        logger.error("Get groups failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to retrieve groups — check server logs")


@router.get("/groups/{attack_id}")
async def group_detail(attack_id: str):
    detail = get_group_detail(attack_id.upper())
    if not detail:
        raise HTTPException(404, f"Group {attack_id} not found")
    return detail


@router.post("/refresh")
async def refresh():
    asyncio.create_task(_do_load())
    return {"ok": True, "message": "ATT&CK refresh queued"}
