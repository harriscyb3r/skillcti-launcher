import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from config import settings
from services.pdf_export import html_to_pdf
from services.pptx_export import outline_to_pptx
from routers.reports import safe_id

logger = logging.getLogger(__name__)

router = APIRouter()


class PdfRequest(BaseModel):
    meta: dict
    html: str


class PptxRequest(BaseModel):
    meta: dict
    outline: dict


@router.post("/generate-pdf")
async def generate_pdf(body: PdfRequest):
    if not body.html or not body.meta.get("id"):
        raise HTTPException(400, "missing html or meta.id")
    rid = safe_id(body.meta["id"])
    body.meta["id"] = rid
    body.meta["format"] = "pdf"
    pdf_path = settings.reports_dir / f"{rid}.pdf"

    try:
        html_to_pdf(body.html, str(pdf_path))
    except RuntimeError as e:
        logger.error("PDF generation failed for %s: %s", rid, e)
        raise HTTPException(500, "PDF generation failed — check server logs")

    body.meta["bytes"] = pdf_path.stat().st_size
    (settings.reports_dir / f"{rid}.meta.json").write_text(
        json.dumps(body.meta, indent=2), encoding="utf-8"
    )
    return Response(
        content=pdf_path.read_bytes(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{rid}.pdf"',
            "X-Report-Id": rid,
        },
    )


@router.post("/generate-pptx")
async def generate_pptx(body: PptxRequest):
    if not body.outline or not body.meta.get("id"):
        raise HTTPException(400, "missing outline or meta.id")
    rid = safe_id(body.meta["id"])
    body.meta["id"] = rid
    body.meta["format"] = "pptx"
    pptx_path = settings.reports_dir / f"{rid}.pptx"

    try:
        outline_to_pptx(body.outline, str(pptx_path))
    except Exception as e:
        logger.error("PPTX generation failed for %s: %s", rid, e)
        raise HTTPException(500, "PPTX generation failed — check server logs")

    body.meta["bytes"] = pptx_path.stat().st_size
    (settings.reports_dir / f"{rid}.meta.json").write_text(
        json.dumps(body.meta, indent=2), encoding="utf-8"
    )
    return Response(
        content=pptx_path.read_bytes(),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={
            "Content-Disposition": f'attachment; filename="{rid}.pptx"',
            "X-Report-Id": rid,
        },
    )
