"""Render structured report markdown into the fixed HTML templates.

Used by the frontend's interactive generation path; background jobs call
services.report_render directly.
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from services.report_render import looks_like_html, render_report_html

router = APIRouter(prefix="/api")


class RenderRequest(BaseModel):
    markdown: str
    mode: str = "dark"        # dark (on-screen HTML) | pdf (white brief)
    skill_name: str = ""
    badge: str = ""


@router.post("/render")
async def render_report(req: RenderRequest):
    # Legacy full-HTML output passes straight through
    if looks_like_html(req.markdown):
        return {"html": req.markdown, "title": req.skill_name}

    mode = "pdf" if req.mode == "pdf" else "dark"
    html, title = render_report_html(
        req.markdown,
        mode=mode,
        fallback_title=req.skill_name or "CTI Report",
        badge=req.badge,
    )
    return {"html": html, "title": title}
