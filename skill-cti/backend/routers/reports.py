import json
import urllib.parse
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from config import settings
from services.style_rule import inject_report_csp

router = APIRouter()


def safe_id(s: str) -> str:
    decoded = urllib.parse.unquote(s or "")
    decoded = decoded.replace("\\", "/").split("/")[-1]
    if not decoded or decoded in (".", ".."):
        return ""
    decoded = "".join(c for c in decoded if c not in "<>\"'\x00\r\n")
    return decoded[:200]


def list_reports() -> list[dict]:
    reports_dir: Path = settings.reports_dir
    reports_dir.mkdir(exist_ok=True)

    for html_file in reports_dir.glob("*.html"):
        meta_file = reports_dir / f"{html_file.stem}.meta.json"
        if not meta_file.exists():
            _adopt_orphan(html_file, reports_dir)

    items = []
    for meta_file in reports_dir.glob("*.meta.json"):
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            mid = meta.get("id", "")
            html_ok  = (reports_dir / f"{mid}.html").exists()
            pdf_ok   = (reports_dir / f"{mid}.pdf").exists()
            pptx_ok  = (reports_dir / f"{mid}.pptx").exists()
            if not (html_ok or pdf_ok or pptx_ok):
                continue
            items.append(meta)
        except Exception:
            continue
    items.sort(key=lambda m: m.get("timestamp", ""), reverse=True)
    return items


def _adopt_orphan(html_file: Path, reports_dir: Path) -> dict:
    from datetime import datetime, timezone
    original_stem = html_file.stem
    safe_stem = "".join(c if c not in "<>\"'\x00\r\n" else "_" for c in original_stem)
    if safe_stem != original_stem:
        new_path = reports_dir / f"{safe_stem}.html"
        html_file.rename(new_path)
        html_file = new_path
    stem = safe_stem
    mtime = datetime.fromtimestamp(html_file.stat().st_mtime, tz=timezone.utc)
    meta = {
        "id": stem,
        "skillId": "imported",
        "skillName": "Imported Report",
        "badge": "IMPORTED",
        "badgeColor": "#6b7280",
        "timestamp": mtime.isoformat(),
        "title": stem.replace("-", " ").replace("_", " ").strip() or stem,
        "inputs": {},
        "bytes": html_file.stat().st_size,
    }
    (reports_dir / f"{stem}.meta.json").write_text(
        json.dumps(meta, indent=2), encoding="utf-8"
    )
    return meta


@router.get("/reports")
async def get_reports():
    return {"reports": list_reports()}


@router.get("/reports/{report_id}/pdf")
async def get_report_pdf(report_id: str):
    rid = safe_id(report_id)
    pdf_file = settings.reports_dir / f"{rid}.pdf"
    if not pdf_file.exists():
        raise HTTPException(404, "pdf not found")
    return Response(
        content=pdf_file.read_bytes(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{rid}.pdf"'},
    )


@router.get("/reports/{report_id}/pptx")
async def get_report_pptx(report_id: str):
    rid = safe_id(report_id)
    pptx_file = settings.reports_dir / f"{rid}.pptx"
    if not pptx_file.exists():
        raise HTTPException(404, "pptx not found")
    return Response(
        content=pptx_file.read_bytes(),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{rid}.pptx"'},
    )


@router.get("/reports/{report_id}")
async def get_report(report_id: str):
    rid = safe_id(report_id)
    meta_file = settings.reports_dir / f"{rid}.meta.json"
    if not meta_file.exists():
        raise HTTPException(404, "report not found")
    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    html_file = settings.reports_dir / f"{rid}.html"
    if meta.get("format") == "pdf" or not html_file.exists():
        return {"meta": meta, "html": None}
    return {"meta": meta, "html": html_file.read_text(encoding="utf-8")}


class SaveReportBody(BaseModel):
    meta: dict
    html: str


@router.post("/reports")
async def save_report(body: SaveReportBody):
    if not body.html or not body.meta.get("id"):
        raise HTTPException(400, "missing html or meta.id")
    rid = safe_id(body.meta["id"])
    body.meta["id"] = rid
    secured_html = inject_report_csp(body.html)
    (settings.reports_dir / f"{rid}.html").write_text(secured_html, encoding="utf-8")
    (settings.reports_dir / f"{rid}.meta.json").write_text(
        json.dumps(body.meta, indent=2), encoding="utf-8"
    )
    return {"ok": True, "id": rid}


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str):
    rid = safe_id(report_id)
    removed = False
    for ext in (".html", ".pdf", ".pptx", ".meta.json"):
        p = settings.reports_dir / f"{rid}{ext}"
        if p.exists():
            p.unlink()
            removed = True
    if not removed:
        raise HTTPException(404, "report not found")
    return {"ok": True}
