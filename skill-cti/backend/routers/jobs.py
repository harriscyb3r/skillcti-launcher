"""
Background job runner for report generation.
The Anthropic API call runs server-side, so generation survives browser
sleep, tab close, or laptop lid-close.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from config import settings
from services.style_rule import inject_style_rule, inject_report_csp
from services.pdf_export import html_to_pdf
from services.pptx_export import outline_to_pptx
from routers.reports import safe_id

router = APIRouter(prefix="/api")

ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
ANTHROPIC_HEADERS = {
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "web-search-2025-03-05",
}

# In-memory stores — jobs persisted to disk, tasks are ephemeral
_jobs: dict[str, dict] = {}
_tasks: dict[str, asyncio.Task] = {}  # running asyncio tasks, keyed by job_id


def _job_file(job_id: str):
    settings.reports_dir.mkdir(exist_ok=True)
    return settings.reports_dir / f"_job-{job_id}.json"


def _save(job: dict) -> None:
    try:
        _job_file(job["id"]).write_text(json.dumps(job, indent=2), encoding="utf-8")
    except Exception:
        pass


def _patch(job: dict, **kw) -> None:
    job.update(kw)
    _save(job)


def _strip_fences(text: str) -> str:
    start = text.find("```")
    if start != -1:
        text = text[start:]
    return text.replace("```html", "").replace("```json", "").replace("```", "").strip()


def _clean_html(text: str) -> str:
    """Extract only the HTML document, stripping any prose before or after."""
    lower = text.lower()
    start = lower.find("<!doctype")
    if start == -1:
        start = lower.find("<html")
    if start == -1:
        return text  # no HTML found — return as-is so error surfaces naturally

    end = lower.rfind("</html>")
    if end == -1:
        return text[start:]  # no closing tag — return from doctype onwards

    return text[start:end + len("</html>")]


def _clean_json(text: str) -> str:
    """Extract only the JSON object, stripping any prose before or after.
    Handles cases where Claude outputs narration around the JSON payload."""
    start = text.find("{")
    if start == -1:
        return text  # no JSON object found — return as-is so error surfaces naturally
    end = text.rfind("}")
    if end == -1:
        return text[start:]  # no closing brace — return from first { onwards
    return text[start:end + 1]


def load_jobs_from_disk() -> None:
    """Called on startup — restore recent jobs from disk."""
    try:
        for f in sorted(settings.reports_dir.glob("_job-*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:50]:
            try:
                job = json.loads(f.read_text(encoding="utf-8"))
                _jobs[job["id"]] = job
            except Exception:
                pass
    except Exception:
        pass


class JobRequest(BaseModel):
    skill_id: str
    skill_name: str
    badge: str
    badge_color: str
    format: str              # html | pdf | pptx
    anthropic_body: dict     # full body (model, system, messages, tools...)


@router.post("/jobs")
async def create_job(req: JobRequest):
    if not settings.anthropic_api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")
    if req.format not in ("html", "pdf", "pptx"):
        raise HTTPException(400, "format must be html, pdf, or pptx")

    job_id = uuid.uuid4().hex[:10]
    report_id = f"{req.skill_id}-{int(time.time())}"

    job: dict = {
        "id": job_id,
        "report_id": report_id,
        "status": "pending",
        "format": req.format,
        "skill_id": req.skill_id,
        "skill_name": req.skill_name,
        "badge": req.badge,
        "badge_color": req.badge_color,
        "progress": "Queued",
        "chars": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "result_report_id": None,
        "download_path": None,
        "error": None,
    }
    _jobs[job_id] = job
    _save(job)

    task = asyncio.create_task(_run_job(job_id, req))
    _tasks[job_id] = task
    task.add_done_callback(lambda _: _tasks.pop(job_id, None))
    print(f"  · job {job_id} created ({req.format}, {req.skill_name})")
    return {"job_id": job_id, "report_id": report_id}


@router.get("/jobs")
async def list_jobs():
    jobs = sorted(_jobs.values(), key=lambda j: j.get("created_at", ""), reverse=True)
    return {"jobs": jobs[:40]}


@router.get("/jobs/active-count")
async def active_count():
    running = sum(1 for j in _jobs.values() if j["status"] in ("pending", "running"))
    return {"running": running}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    if job_id in _jobs:
        return _jobs[job_id]
    f = _job_file(job_id)
    if f.exists():
        try:
            job = json.loads(f.read_text(encoding="utf-8"))
            _jobs[job_id] = job
            return job
        except Exception:
            pass
    raise HTTPException(404, "Job not found")


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    # Cancel the asyncio task if it is still running
    task = _tasks.pop(job_id, None)
    if task and not task.done():
        task.cancel()
    _jobs.pop(job_id, None)
    f = _job_file(job_id)
    if f.exists():
        f.unlink()
    return {"ok": True}


async def _run_job(job_id: str, req: JobRequest) -> None:
    job = _jobs[job_id]
    _patch(job, status="running", progress="Calling Anthropic...")

    # Inject anti-em-dash style rule into the system prompt
    body = dict(req.anthropic_body)
    body["stream"] = True
    raw = inject_style_rule(json.dumps(body).encode())
    body = json.loads(raw)

    headers = {
        **ANTHROPIC_HEADERS,
        "x-api-key": settings.anthropic_api_key,
        "Content-Type": "application/json",
    }

    accumulated = ""
    try:
        async with httpx.AsyncClient(timeout=600) as client:
            async with client.stream(
                "POST", ANTHROPIC_API,
                content=json.dumps(body).encode(),
                headers=headers,
            ) as resp:
                if resp.status_code != 200:
                    err = await resp.aread()
                    logger.error("Anthropic API error %s for job %s: %s", resp.status_code, job_id, err.decode()[:300])
                    raise RuntimeError(f"Anthropic API returned {resp.status_code} — check server logs")

                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    raw_data = line[5:].strip()
                    if not raw_data or raw_data == "[DONE]":
                        continue
                    try:
                        event = json.loads(raw_data)
                    except Exception:
                        continue

                    if event.get("type") == "error" or event.get("error"):
                        logger.error("Anthropic stream error for job %s: %s", job_id, json.dumps(event.get("error", event))[:200])
                        raise RuntimeError("Anthropic stream error — check server logs")

                    if event.get("type") == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            accumulated += delta.get("text", "")
                            n = len(accumulated)
                            if n % 500 < 40:
                                _patch(job,
                                    progress=f"Generating... {n:,} chars",
                                    chars=n)

        n = len(accumulated)
        _patch(job, progress=f"Processing {req.format.upper()}...", chars=n)
        print(f"  · job {job_id} accumulated {n:,} chars")

        content = _strip_fences(accumulated)
        safe_rid = safe_id(job["report_id"])
        _patch(job, report_id=safe_rid)

        meta = {
            "id": safe_rid,
            "skillId": req.skill_id,
            "skillName": req.skill_name,
            "badge": req.badge,
            "badgeColor": req.badge_color,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "title": req.skill_name,
            "inputs": {},
            "format": req.format,
        }

        if req.format == "html":
            _patch(job, progress="Saving report...")
            content = inject_report_csp(_clean_html(content))
            html_path = settings.reports_dir / f"{safe_rid}.html"
            html_path.write_text(content, encoding="utf-8")
            meta["bytes"] = html_path.stat().st_size
            (settings.reports_dir / f"{safe_rid}.meta.json").write_text(
                json.dumps(meta, indent=2), encoding="utf-8"
            )
            _patch(job,
                status="done",
                progress="Done",
                completed_at=datetime.now(timezone.utc).isoformat(),
                result_report_id=safe_rid,
            )

        elif req.format == "pdf":
            _patch(job, progress="Generating PDF...")
            pdf_path = settings.reports_dir / f"{safe_rid}.pdf"
            html_to_pdf(_clean_html(content), str(pdf_path))
            meta["bytes"] = pdf_path.stat().st_size
            (settings.reports_dir / f"{safe_rid}.meta.json").write_text(
                json.dumps(meta, indent=2), encoding="utf-8"
            )
            _patch(job,
                status="done",
                progress="Done",
                completed_at=datetime.now(timezone.utc).isoformat(),
                result_report_id=safe_rid,
                download_path=f"/reports/{safe_rid}/pdf",
            )

        elif req.format == "pptx":
            _patch(job, progress="Building PowerPoint...")
            try:
                outline = json.loads(_clean_json(content))
            except Exception:
                raise RuntimeError("Model returned invalid JSON for PPTX outline")
            pptx_path = settings.reports_dir / f"{safe_rid}.pptx"
            outline_to_pptx(outline, str(pptx_path))
            meta["bytes"] = pptx_path.stat().st_size
            (settings.reports_dir / f"{safe_rid}.meta.json").write_text(
                json.dumps(meta, indent=2), encoding="utf-8"
            )
            _patch(job,
                status="done",
                progress="Done",
                completed_at=datetime.now(timezone.utc).isoformat(),
                result_report_id=safe_rid,
                download_path=f"/reports/{safe_rid}/pptx",
            )

        print(f"  · job {job_id} done → {safe_rid}.{req.format}")

    except Exception as e:
        logger.error("Job %s failed: %s", job_id, e, exc_info=True)
        _patch(job,
            status="error",
            progress="Failed",
            error=str(e),
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
