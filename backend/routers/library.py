"""Intelligence Library API router."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.library import (
    create_item, get_item, update_item, delete_item,
    search_items, get_all_tags, count_items,
)

router = APIRouter(prefix="/api/library", tags=["library"])
logger = logging.getLogger(__name__)


class CreateItemRequest(BaseModel):
    type: str = "note"
    title: str
    summary: str = ""
    content: dict[str, Any] = {}
    notes: str = ""
    tags: list[str] = []
    source: str = ""
    tlp: str = "TLP:AMBER"
    verdict: str | None = None


class UpdateItemRequest(BaseModel):
    type: str | None = None
    title: str | None = None
    summary: str | None = None
    content: dict[str, Any] | None = None
    notes: str | None = None
    tags: list[str] | None = None
    source: str | None = None
    tlp: str | None = None
    verdict: str | None = None


@router.get("")
async def list_items(
    q: str = "",
    type: str = "",
    tag: str = "",
    verdict: str = "",
    limit: int = 200,
    offset: int = 0,
):
    try:
        items = search_items(
            q=q,
            type_filter=type or None,
            tag=tag or None,
            verdict_filter=verdict or None,
            limit=limit,
            offset=offset,
        )
        tags = get_all_tags()
        counts = count_items()
        return {"items": items, "tags": tags, "counts": counts}
    except Exception as e:
        logger.error("Library list failed: %s", e, exc_info=True)
        raise HTTPException(500, "Library query failed — check server logs")


@router.post("")
async def create(req: CreateItemRequest):
    try:
        item = create_item(
            type=req.type,
            title=req.title,
            summary=req.summary,
            content=req.content,
            notes=req.notes,
            tags=req.tags,
            source=req.source,
            tlp=req.tlp,
            verdict=req.verdict,
        )
        return item
    except Exception as e:
        logger.error("Library create failed: %s", e, exc_info=True)
        raise HTTPException(500, "Library create failed — check server logs")


@router.get("/{item_id}")
async def get(item_id: str):
    item = get_item(item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    return item


@router.put("/{item_id}")
async def update(item_id: str, req: UpdateItemRequest):
    if not get_item(item_id):
        raise HTTPException(404, "Item not found")
    try:
        updates = req.model_dump(exclude_none=True)
        item = update_item(item_id, **updates)
        return item
    except Exception as e:
        logger.error("Library update failed: %s", e, exc_info=True)
        raise HTTPException(500, "Library update failed — check server logs")


@router.delete("/{item_id}")
async def delete(item_id: str):
    if not delete_item(item_id):
        raise HTTPException(404, "Item not found")
    return {"ok": True}
