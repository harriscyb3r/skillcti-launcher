"""Case Management API router."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.cases import (
    list_cases, create_case, get_case, update_case, delete_case,
    add_note, delete_note, add_artifact, delete_artifact,
)

router = APIRouter(prefix="/api/cases", tags=["cases"])
logger = logging.getLogger(__name__)


class CreateCaseRequest(BaseModel):
    title: str
    description: str = ""
    status: str = "open"
    priority: str = "medium"
    tlp: str = "TLP:AMBER"
    tags: list[str] = []


class UpdateCaseRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    tlp: str | None = None
    tags: list[str] | None = None


class AddNoteRequest(BaseModel):
    content: str


class AddArtifactRequest(BaseModel):
    artifact_type: str = "ioc"
    value: str
    label: str = ""


@router.get("")
async def list_all(status: str = ""):
    try:
        cases = list_cases(status or None)
        return {"cases": cases}
    except Exception as e:
        logger.error("Cases list failed: %s", e, exc_info=True)
        raise HTTPException(500, "Cases query failed")


@router.post("")
async def create(req: CreateCaseRequest):
    try:
        case = create_case(
            title=req.title,
            description=req.description,
            status=req.status,
            priority=req.priority,
            tlp=req.tlp,
            tags=req.tags,
        )
        return case
    except Exception as e:
        logger.error("Case create failed: %s", e, exc_info=True)
        raise HTTPException(500, "Case create failed")


@router.get("/{case_id}")
async def get(case_id: str):
    case = get_case(case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    return case


@router.put("/{case_id}")
async def update(case_id: str, req: UpdateCaseRequest):
    if not get_case(case_id):
        raise HTTPException(404, "Case not found")
    updates: dict[str, Any] = req.model_dump(exclude_none=True)
    case = update_case(case_id, **updates)
    return case


@router.delete("/{case_id}")
async def delete(case_id: str):
    if not delete_case(case_id):
        raise HTTPException(404, "Case not found")
    return {"ok": True}


@router.post("/{case_id}/notes")
async def post_note(case_id: str, req: AddNoteRequest):
    if not get_case(case_id):
        raise HTTPException(404, "Case not found")
    if not req.content.strip():
        raise HTTPException(400, "Note content cannot be empty")
    note = add_note(case_id, req.content.strip())
    return note


@router.delete("/{case_id}/notes/{note_id}")
async def remove_note(case_id: str, note_id: str):
    if not delete_note(note_id):
        raise HTTPException(404, "Note not found")
    return {"ok": True}


@router.post("/{case_id}/artifacts")
async def post_artifact(case_id: str, req: AddArtifactRequest):
    if not get_case(case_id):
        raise HTTPException(404, "Case not found")
    if not req.value.strip():
        raise HTTPException(400, "Artifact value cannot be empty")
    artifact = add_artifact(case_id, req.artifact_type, req.value.strip(), req.label.strip())
    return artifact


@router.delete("/{case_id}/artifacts/{artifact_id}")
async def remove_artifact(case_id: str, artifact_id: str):
    if not delete_artifact(artifact_id):
        raise HTTPException(404, "Artifact not found")
    return {"ok": True}
