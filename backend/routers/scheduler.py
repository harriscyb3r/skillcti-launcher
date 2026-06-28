"""Scheduled Reports API — CRUD for schedule definitions."""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.scheduler import (
    create_schedule,
    list_schedules,
    get_schedule,
    update_schedule,
    delete_schedule,
    get_due_schedules,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/schedules")


class CreateScheduleRequest(BaseModel):
    skill_id: str
    skill_name: str
    skill_path: str
    badge: str = ""
    badge_color: str = "#64748b"
    user_message: str
    format: str = "html"
    model: str = "claude-sonnet-4-6"
    max_tokens: int = Field(default=8000, ge=1000, le=64000)
    needs_search: bool = True
    frequency: str = "daily"
    hour: int = Field(default=8, ge=0, le=23)
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    day_of_month: int | None = Field(default=None, ge=1, le=28)
    enabled: bool = True


class UpdateScheduleRequest(BaseModel):
    user_message: str | None = None
    format: str | None = None
    model: str | None = None
    max_tokens: int | None = None
    needs_search: bool | None = None
    frequency: str | None = None
    hour: int | None = None
    day_of_week: int | None = None
    day_of_month: int | None = None
    enabled: bool | None = None


def _validate_frequency(frequency: str | None) -> None:
    if frequency and frequency not in ("daily", "weekly", "monthly"):
        raise HTTPException(400, "frequency must be daily, weekly, or monthly")


def _validate_format(fmt: str | None) -> None:
    if fmt and fmt not in ("html", "pdf", "pptx"):
        raise HTTPException(400, "format must be html, pdf, or pptx")


@router.get("")
async def list_all():
    return {"schedules": list_schedules()}


@router.post("")
async def create(req: CreateScheduleRequest):
    _validate_frequency(req.frequency)
    _validate_format(req.format)
    if not req.skill_path or "/" in req.skill_path or ".." in req.skill_path:
        raise HTTPException(400, "invalid skill_path")
    if not req.user_message.strip():
        raise HTTPException(400, "user_message must not be empty")

    sched = create_schedule(
        skill_id=req.skill_id,
        skill_name=req.skill_name,
        skill_path=req.skill_path,
        badge=req.badge,
        badge_color=req.badge_color,
        user_message=req.user_message,
        format=req.format,
        model=req.model,
        max_tokens=req.max_tokens,
        needs_search=req.needs_search,
        frequency=req.frequency,
        hour=req.hour,
        day_of_week=req.day_of_week,
        day_of_month=req.day_of_month,
        enabled=req.enabled,
    )
    return sched


@router.get("/{sched_id}")
async def get_one(sched_id: str):
    sched = get_schedule(sched_id)
    if not sched:
        raise HTTPException(404, "Schedule not found")
    return sched


@router.put("/{sched_id}")
async def update(sched_id: str, req: UpdateScheduleRequest):
    _validate_frequency(req.frequency)
    _validate_format(req.format)

    updates = req.model_dump(exclude_none=True)
    if not updates:
        sched = get_schedule(sched_id)
        if not sched:
            raise HTTPException(404, "Schedule not found")
        return sched

    sched = update_schedule(sched_id, **updates)
    if not sched:
        raise HTTPException(404, "Schedule not found")
    return sched


@router.delete("/{sched_id}")
async def delete(sched_id: str):
    if not delete_schedule(sched_id):
        raise HTTPException(404, "Schedule not found")
    return {"ok": True}


@router.post("/{sched_id}/trigger")
async def trigger_now(sched_id: str):
    """Manually fire a schedule immediately regardless of next_run."""
    sched = get_schedule(sched_id)
    if not sched:
        raise HTTPException(404, "Schedule not found")

    from scheduler_runner import _fire_schedule
    asyncio.create_task(_fire_schedule(sched))
    return {"ok": True}
