"""Priority Intelligence Requirements API router."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.pir import (
    list_pirs, create_pir, get_pir, update_pir, delete_pir,
    add_finding, delete_finding,
)

router = APIRouter(prefix="/api/pir", tags=["pir"])
logger = logging.getLogger(__name__)


class CreatePirRequest(BaseModel):
    title: str
    description: str = ""
    category: str = "general"
    priority: str = "medium"
    status: str = "active"
    rescan_days: int = 30
    owner: str = ""
    tags: list[str] = []


class UpdatePirRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    priority: str | None = None
    status: str | None = None
    rescan_days: int | None = None
    owner: str | None = None
    tags: list[str] | None = None


class AddFindingRequest(BaseModel):
    content: str
    source: str = ""


@router.get("")
async def list_all(status: str = "", priority: str = "", category: str = ""):
    try:
        pirs = list_pirs(
            status=status or None,
            priority=priority or None,
            category=category or None,
        )
        return {"pirs": pirs}
    except Exception as e:
        logger.error("PIR list failed: %s", e, exc_info=True)
        raise HTTPException(500, "PIR query failed")


@router.post("")
async def create(req: CreatePirRequest):
    try:
        pir = create_pir(
            title=req.title,
            description=req.description,
            category=req.category,
            priority=req.priority,
            status=req.status,
            rescan_days=req.rescan_days,
            owner=req.owner,
            tags=req.tags,
        )
        return pir
    except Exception as e:
        logger.error("PIR create failed: %s", e, exc_info=True)
        raise HTTPException(500, "PIR create failed")


@router.get("/{pir_id}")
async def get(pir_id: str):
    pir = get_pir(pir_id)
    if not pir:
        raise HTTPException(404, "PIR not found")
    return pir


@router.put("/{pir_id}")
async def update(pir_id: str, req: UpdatePirRequest):
    if not get_pir(pir_id):
        raise HTTPException(404, "PIR not found")
    updates: dict[str, Any] = req.model_dump(exclude_none=True)
    pir = update_pir(pir_id, **updates)
    return pir


@router.delete("/{pir_id}")
async def delete(pir_id: str):
    if not delete_pir(pir_id):
        raise HTTPException(404, "PIR not found")
    return {"ok": True}


@router.post("/{pir_id}/findings")
async def post_finding(pir_id: str, req: AddFindingRequest):
    if not get_pir(pir_id):
        raise HTTPException(404, "PIR not found")
    if not req.content.strip():
        raise HTTPException(400, "Finding content cannot be empty")
    finding = add_finding(pir_id, req.content.strip(), req.source.strip())
    return finding


@router.delete("/{pir_id}/findings/{finding_id}")
async def remove_finding(pir_id: str, finding_id: str):
    if not delete_finding(finding_id):
        raise HTTPException(404, "Finding not found")
    return {"ok": True}
