"""Threat Hunt Management API router."""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings
from services.hunts import (
    list_hunts, create_hunt, get_hunt, update_hunt, delete_hunt,
    add_note, delete_note,
    add_query, update_query, delete_query,
    add_finding, update_finding, delete_finding,
)

router = APIRouter(prefix="/api/hunts", tags=["hunts"])
logger = logging.getLogger(__name__)

# ── Request models ─────────────────────────────────────────────────────────────

class CreateHuntRequest(BaseModel):
    title: str
    hypothesis: str = ""
    description: str = ""
    status: str = "planning"
    priority: str = "medium"
    tlp: str = "TLP:AMBER"
    platform: str = "Microsoft Sentinel"
    timeframe: str = "30d"
    intel_source: str = ""
    mitre_techniques: list = []
    tags: list[str] = []


class UpdateHuntRequest(BaseModel):
    title: str | None = None
    hypothesis: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    tlp: str | None = None
    platform: str | None = None
    timeframe: str | None = None
    intel_source: str | None = None
    mitre_techniques: list | None = None
    verdict: str | None = None
    tags: list[str] | None = None


class AddNoteRequest(BaseModel):
    content: str


class AddQueryRequest(BaseModel):
    title: str
    phase: str = "anomaly-detection"
    query_type: str = "broad"
    technique_id: str = ""
    query_text: str
    platform: str = ""
    false_positives: str = ""
    notes: str = ""


class UpdateQueryRequest(BaseModel):
    title: str | None = None
    phase: str | None = None
    query_type: str | None = None
    technique_id: str | None = None
    query_text: str | None = None
    platform: str | None = None
    false_positives: str | None = None
    notes: str | None = None


class AddFindingRequest(BaseModel):
    timestamp_utc: str = ""
    host: str = ""
    user_field: str = ""
    indicator: str = ""
    tactic: str = ""
    notes: str = ""
    status: str = "suspicious"


class UpdateFindingRequest(BaseModel):
    timestamp_utc: str | None = None
    host: str | None = None
    user_field: str | None = None
    indicator: str | None = None
    tactic: str | None = None
    notes: str | None = None
    status: str | None = None


class GenerateRequest(BaseModel):
    additional_context: str = ""


# ── CRUD routes ────────────────────────────────────────────────────────────────

@router.get("")
async def list_all(status: str = ""):
    try:
        return {"hunts": list_hunts(status or None)}
    except Exception as e:
        logger.error("Hunts list failed: %s", e, exc_info=True)
        raise HTTPException(500, "Hunts query failed")


@router.post("")
async def create(req: CreateHuntRequest):
    try:
        hunt = create_hunt(
            title=req.title,
            hypothesis=req.hypothesis,
            description=req.description,
            status=req.status,
            priority=req.priority,
            tlp=req.tlp,
            platform=req.platform,
            timeframe=req.timeframe,
            intel_source=req.intel_source,
            mitre_techniques=req.mitre_techniques,
            tags=req.tags,
        )
        return hunt
    except Exception as e:
        logger.error("Hunt create failed: %s", e, exc_info=True)
        raise HTTPException(500, "Hunt create failed")


@router.get("/{hunt_id}")
async def get(hunt_id: str):
    hunt = get_hunt(hunt_id)
    if not hunt:
        raise HTTPException(404, "Hunt not found")
    return hunt


@router.put("/{hunt_id}")
async def update(hunt_id: str, req: UpdateHuntRequest):
    if not get_hunt(hunt_id):
        raise HTTPException(404, "Hunt not found")
    updates: dict[str, Any] = req.model_dump(exclude_none=True)
    hunt = update_hunt(hunt_id, **updates)
    return hunt


@router.delete("/{hunt_id}")
async def delete(hunt_id: str):
    if not delete_hunt(hunt_id):
        raise HTTPException(404, "Hunt not found")
    return {"ok": True}


# ── Notes ─────────────────────────────────────────────────────────────────────

@router.post("/{hunt_id}/notes")
async def post_note(hunt_id: str, req: AddNoteRequest):
    if not get_hunt(hunt_id):
        raise HTTPException(404, "Hunt not found")
    if not req.content.strip():
        raise HTTPException(400, "Note content cannot be empty")
    return add_note(hunt_id, req.content.strip())


@router.delete("/{hunt_id}/notes/{note_id}")
async def remove_note(hunt_id: str, note_id: str):
    if not delete_note(note_id):
        raise HTTPException(404, "Note not found")
    return {"ok": True}


# ── Queries ───────────────────────────────────────────────────────────────────

@router.post("/{hunt_id}/queries")
async def post_query(hunt_id: str, req: AddQueryRequest):
    if not get_hunt(hunt_id):
        raise HTTPException(404, "Hunt not found")
    if not req.query_text.strip():
        raise HTTPException(400, "Query text cannot be empty")
    return add_query(
        hunt_id,
        title=req.title,
        phase=req.phase,
        query_type=req.query_type,
        technique_id=req.technique_id,
        query_text=req.query_text,
        platform=req.platform,
        false_positives=req.false_positives,
        notes=req.notes,
    )


@router.put("/{hunt_id}/queries/{query_id}")
async def put_query(hunt_id: str, query_id: str, req: UpdateQueryRequest):
    updates = req.model_dump(exclude_none=True)
    result = update_query(query_id, **updates)
    if not result:
        raise HTTPException(404, "Query not found")
    return result


@router.delete("/{hunt_id}/queries/{query_id}")
async def remove_query(hunt_id: str, query_id: str):
    if not delete_query(query_id):
        raise HTTPException(404, "Query not found")
    return {"ok": True}


# ── Findings ──────────────────────────────────────────────────────────────────

@router.post("/{hunt_id}/findings")
async def post_finding(hunt_id: str, req: AddFindingRequest):
    if not get_hunt(hunt_id):
        raise HTTPException(404, "Hunt not found")
    return add_finding(
        hunt_id,
        timestamp_utc=req.timestamp_utc,
        host=req.host,
        user_field=req.user_field,
        indicator=req.indicator,
        tactic=req.tactic,
        notes=req.notes,
        status=req.status,
    )


@router.put("/{hunt_id}/findings/{finding_id}")
async def put_finding(hunt_id: str, finding_id: str, req: UpdateFindingRequest):
    updates = req.model_dump(exclude_none=True)
    result = update_finding(finding_id, **updates)
    if not result:
        raise HTTPException(404, "Finding not found")
    return result


@router.delete("/{hunt_id}/findings/{finding_id}")
async def remove_finding(hunt_id: str, finding_id: str):
    if not delete_finding(finding_id):
        raise HTTPException(404, "Finding not found")
    return {"ok": True}


# ── AI Generate ───────────────────────────────────────────────────────────────

_GENERATE_SYSTEM = """You are a Senior Threat Hunter. Given a hunt hypothesis, platform, and optional intel context, produce a structured hunt plan as a JSON object. Return ONLY valid JSON, no markdown fences, no prose.

Schema:
{
  "hypotheses": [
    {
      "title": "string -- concise hypothesis statement",
      "rationale": "string -- why this behaviour is plausible given the intel (1-2 sentences)",
      "mitre_id": "string -- e.g. T1059.001",
      "mitre_name": "string -- technique name",
      "tactic": "string -- tactic name e.g. Execution",
      "priority": "high|medium|low",
      "confidence": "high|medium|low"
    }
  ],
  "mitre_techniques": [
    {"id": "T####.###", "name": "string", "tactic": "string"}
  ],
  "methodology": "string -- 4-6 bullet points as a single string separated by newlines, covering: baseline, anomaly detection, triage, confirmation, evidence collection",
  "queries": [
    {
      "title": "string -- concise query title",
      "phase": "baseline|anomaly-detection|triage|confirmation|evidence-collection",
      "query_type": "broad|focused|pivot",
      "technique_id": "string -- MITRE ID this query targets",
      "query_text": "string -- full query for the specified platform",
      "false_positives": "string -- 1-2 concrete FP scenarios",
      "notes": "string -- brief tuning note"
    }
  ]
}

Rules:
- Produce 2-4 hypotheses. The first is primary; the rest are the backlog.
- List all unique MITRE techniques across all hypotheses in mitre_techniques.
- Produce at least 3 queries (1 broad sweep, 1 focused triage, 1 pivot) for the primary hypothesis technique.
- Write queries for the exact platform specified (KQL for Sentinel/Defender, SPL for Splunk, EQL for Elastic, generic Sigma-style pseudocode for Generic).
- For KQL queries, start with: let timeframe = 30d;
- For SPL queries, use: earliest=-30d latest=now
- Do not use em dashes anywhere in the output.
- Return ONLY the JSON object. No preamble, no explanation."""


@router.post("/{hunt_id}/generate")
async def generate(hunt_id: str, req: GenerateRequest):
    hunt = get_hunt(hunt_id)
    if not hunt:
        raise HTTPException(404, "Hunt not found")

    if not settings.anthropic_api_key:
        raise HTTPException(400, "Anthropic API key not configured")

    user_msg_parts = [
        f"Hunt title: {hunt['title']}",
        f"Hypothesis: {hunt['hypothesis'] or '(none -- derive from intel below)'}",
        f"Platform: {hunt['platform']}",
        f"Timeframe: {hunt['timeframe']}",
    ]
    if hunt.get("intel_source"):
        user_msg_parts.append(f"Intel source / context: {hunt['intel_source']}")
    if req.additional_context.strip():
        user_msg_parts.append(f"Additional context: {req.additional_context.strip()}")
    if hunt.get("description"):
        user_msg_parts.append(f"Description: {hunt['description']}")

    user_msg = "\n".join(user_msg_parts)

    payload = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 8000,
        "system": _GENERATE_SYSTEM,
        "messages": [{"role": "user", "content": user_msg}],
    }

    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers=headers,
            )
        if resp.status_code != 200:
            logger.error("Anthropic API error %s: %s", resp.status_code, resp.text[:500])
            raise HTTPException(502, f"AI generation failed: {resp.status_code}")

        data = resp.json()
        raw_text = data["content"][0]["text"].strip()

        # Strip markdown fences if the model wraps in them anyway
        if raw_text.startswith("```"):
            lines = raw_text.splitlines()
            raw_text = "\n".join(
                l for l in lines
                if not l.strip().startswith("```")
            ).strip()

        result = json.loads(raw_text)
        return result

    except json.JSONDecodeError as e:
        logger.error("Failed to parse AI JSON response: %s", e)
        raise HTTPException(502, "AI returned invalid JSON")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Hunt generate failed: %s", e, exc_info=True)
        raise HTTPException(500, "Hunt generation failed")
