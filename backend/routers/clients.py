"""Client/Engagement Manager API router."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.clients import (
    list_clients, create_client, get_client, update_client, delete_client,
)

router = APIRouter(prefix="/api/clients", tags=["clients"])
logger = logging.getLogger(__name__)


class CreateClientRequest(BaseModel):
    name: str
    industry: str = ""
    engagement_ref: str = ""
    status: str = "active"
    key_assets: str = ""
    threat_context: str = ""
    contact_name: str = ""
    contact_email: str = ""
    notes: str = ""
    tags: list[str] = []


class UpdateClientRequest(BaseModel):
    name: str | None = None
    industry: str | None = None
    engagement_ref: str | None = None
    status: str | None = None
    key_assets: str | None = None
    threat_context: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    notes: str | None = None
    tags: list[str] | None = None


@router.get("")
async def list_all(status: str = "", q: str = ""):
    try:
        clients = list_clients(status or None, q or None)
        return {"clients": clients}
    except Exception as e:
        logger.error("Clients list failed: %s", e, exc_info=True)
        raise HTTPException(500, "Clients query failed")


@router.post("")
async def create(req: CreateClientRequest):
    try:
        client = create_client(
            name=req.name,
            industry=req.industry,
            engagement_ref=req.engagement_ref,
            status=req.status,
            key_assets=req.key_assets,
            threat_context=req.threat_context,
            contact_name=req.contact_name,
            contact_email=req.contact_email,
            notes=req.notes,
            tags=req.tags,
        )
        return client
    except Exception as e:
        logger.error("Client create failed: %s", e, exc_info=True)
        raise HTTPException(500, "Client create failed")


@router.get("/{client_id}")
async def get(client_id: str):
    client = get_client(client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    return client


@router.put("/{client_id}")
async def update(client_id: str, req: UpdateClientRequest):
    if not get_client(client_id):
        raise HTTPException(404, "Client not found")
    updates: dict[str, Any] = req.model_dump(exclude_none=True)
    client = update_client(client_id, **updates)
    return client


@router.delete("/{client_id}")
async def delete(client_id: str):
    if not delete_client(client_id):
        raise HTTPException(404, "Client not found")
    return {"ok": True}
