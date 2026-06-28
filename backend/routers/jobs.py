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
from services.report_render import looks_like_html, render_report_html
from routers.reports import safe_id

router = APIRouter(prefix="/api")

ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
ANTHROPIC_HEADERS = {
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "web-search-2025-03-05",
}

# Pricing in USD per million tokens: (input, output)
_PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4":   (15.0, 75.0),
    "claude-sonnet-4": (3.0,  15.0),
    "claude-haiku-4":  (0.80, 4.0),
    "claude-opus-3":   (15.0, 75.0),
    "claude-sonnet-3": (3.0,  15.0),
    "claude-haiku-3":  (0.25, 1.25),
}


def _compute_cost(model: str, input_tok: int, output_tok: int, cache_read: int, cache_write: int) -> float:
    base_in, base_out = next(
        (v for k, v in _PRICING.items() if model.startswith(k)),
        (3.0, 15.0),
    )
    cost = (
        input_tok  * base_in  / 1_000_000
        + output_tok * base_out / 1_000_000
        + cache_read  * base_in * 0.10 / 1_000_000
        + cache_write * base_in * 1.25 / 1_000_000
    )
    return round(cost, 6)

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


def _log(job: dict, msg: str) -> None:
    """Append a milestone log entry and keep `progress` in sync."""
    job.setdefault("log", []).append({"t": time.time(), "msg": msg})
    job["progress"] = msg
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
        "log": [],
        "chars": 0,
        "model": req.anthropic_body.get("model", "unknown"),
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_creation_tokens": 0,
        "cost_usd": 0.0,
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
    _patch(job, status="running")
    _log(job, "Preparing request")

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
    input_tokens = 0
    output_tokens = 0
    cache_read_tokens = 0
    cache_creation_tokens = 0
    first_token = False
    last_char_save = 0
    try:
        _log(job, "Calling Anthropic API")
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

                    if event.get("type") == "message_start":
                        usage = event.get("message", {}).get("usage", {})
                        input_tokens = usage.get("input_tokens", 0)
                        cache_read_tokens = usage.get("cache_read_input_tokens", 0)
                        cache_creation_tokens = usage.get("cache_creation_input_tokens", 0)

                    elif event.get("type") == "message_delta":
                        output_tokens = event.get("usage", {}).get("output_tokens", 0)

                    elif event.get("type") == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            accumulated += delta.get("text", "")
                            n = len(accumulated)

                            if not first_token:
                                first_token = True
                                _log(job, "Generating content")

                            # Throttle char-count saves to every 1 000 chars (not milestone log entries)
                            if n - last_char_save >= 1000:
                                last_char_save = n
                                job["chars"] = n
                                job["progress"] = f"Writing... {n:,} chars"
                                _save(job)

        n = len(accumulated)
        model = req.anthropic_body.get("model", "unknown")
        cost_usd = _compute_cost(model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens)
        _patch(job,
            chars=n,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=cache_read_tokens,
            cache_creation_tokens=cache_creation_tokens,
            cost_usd=cost_usd,
        )
        print(f"  · job {job_id} accumulated {n:,} chars | {input_tokens}+{output_tokens} tok | ${cost_usd:.4f}")

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
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cache_read_tokens": cache_read_tokens,
            "cache_creation_tokens": cache_creation_tokens,
            "cost_usd": cost_usd,
        }

        if req.format == "html":
            _log(job, "Rendering HTML report")
            if looks_like_html(accumulated):
                content = _clean_html(_strip_fences(accumulated))
            else:
                content, fm_title = render_report_html(
                    accumulated, mode="dark",
                    fallback_title=req.skill_name, badge=req.badge,
                )
                meta["title"] = fm_title
            content = inject_report_csp(content)
            _log(job, "Saving to reports library")
            html_path = settings.reports_dir / f"{safe_rid}.html"
            html_path.write_text(content, encoding="utf-8")
            meta["bytes"] = html_path.stat().st_size
            (settings.reports_dir / f"{safe_rid}.meta.json").write_text(
                json.dumps(meta, indent=2), encoding="utf-8"
            )
            _log(job, "Report ready")
            _patch(job,
                status="done",
                completed_at=datetime.now(timezone.utc).isoformat(),
                result_report_id=safe_rid,
            )

        elif req.format == "pdf":
            _log(job, "Rendering HTML for PDF")
            if looks_like_html(accumulated):
                html_doc = _clean_html(_strip_fences(accumulated))
            else:
                html_doc, fm_title = render_report_html(
                    accumulated, mode="pdf",
                    fallback_title=req.skill_name, badge=req.badge,
                )
                meta["title"] = fm_title
            _log(job, "Generating PDF")
            pdf_path = settings.reports_dir / f"{safe_rid}.pdf"
            html_to_pdf(html_doc, str(pdf_path))
            meta["bytes"] = pdf_path.stat().st_size
            (settings.reports_dir / f"{safe_rid}.meta.json").write_text(
                json.dumps(meta, indent=2), encoding="utf-8"
            )
            _log(job, "Report ready")
            _patch(job,
                status="done",
                completed_at=datetime.now(timezone.utc).isoformat(),
                result_report_id=safe_rid,
                download_path=f"/reports/{safe_rid}/pdf",
            )

        elif req.format == "pptx":
            _log(job, "Parsing slide outline")
            try:
                outline = json.loads(_clean_json(_strip_fences(accumulated)))
            except Exception:
                raise RuntimeError("Model returned invalid JSON for PPTX outline")
            _log(job, "Building PowerPoint")
            pptx_path = settings.reports_dir / f"{safe_rid}.pptx"
            outline_to_pptx(outline, str(pptx_path))
            meta["bytes"] = pptx_path.stat().st_size
            (settings.reports_dir / f"{safe_rid}.meta.json").write_text(
                json.dumps(meta, indent=2), encoding="utf-8"
            )
            _log(job, "Report ready")
            _patch(job,
                status="done",
                completed_at=datetime.now(timezone.utc).isoformat(),
                result_report_id=safe_rid,
                download_path=f"/reports/{safe_rid}/pptx",
            )

        print(f"  · job {job_id} done → {safe_rid}.{req.format}")

    except Exception as e:
        logger.error("Job %s failed: %s", job_id, e, exc_info=True)
        _log(job, f"Failed: {str(e)[:120]}")
        _patch(job,
            status="error",
            error=str(e),
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
