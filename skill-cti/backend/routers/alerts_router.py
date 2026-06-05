import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api")

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_ALERTS_FILE = _DATA_DIR / "alerts.json"


def read_alerts() -> list[dict[str, Any]]:
    try:
        if _ALERTS_FILE.exists():
            return json.loads(_ALERTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []


def write_alerts(alerts: list[dict[str, Any]]) -> None:
    _DATA_DIR.mkdir(exist_ok=True)
    _ALERTS_FILE.write_text(json.dumps(alerts, indent=2), encoding="utf-8")


def create_alert(
    *,
    item_id: str,
    item_value: str,
    item_type: str,
    alert_type: str,
    severity: str,
    title: str,
    detail: str,
    matches: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    alert: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "item_id": item_id,
        "item_value": item_value,
        "item_type": item_type,
        "alert_type": alert_type,
        "severity": severity,
        "title": title,
        "detail": detail,
        "matches": matches or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
    }
    alerts = read_alerts()
    alerts.insert(0, alert)
    write_alerts(alerts[:500])
    return alert


@router.get("/alerts")
async def get_alerts(unread_only: bool = False):
    alerts = read_alerts()
    filtered = [a for a in alerts if not a.get("read")] if unread_only else alerts
    return {
        "alerts": filtered,
        "unread_count": sum(1 for a in alerts if not a.get("read")),
    }


@router.get("/alerts/count")
async def alert_count():
    alerts = read_alerts()
    return {"unread": sum(1 for a in alerts if not a.get("read")), "total": len(alerts)}


@router.post("/alerts/{alert_id}/read")
async def mark_read(alert_id: str):
    alerts = read_alerts()
    found = False
    for a in alerts:
        if a["id"] == alert_id:
            a["read"] = True
            found = True
    if not found:
        raise HTTPException(404, "Alert not found")
    write_alerts(alerts)
    return {"ok": True}


@router.post("/alerts/read-all")
async def mark_all_read():
    alerts = read_alerts()
    for a in alerts:
        a["read"] = True
    write_alerts(alerts)
    return {"ok": True}


@router.delete("/alerts/{alert_id}")
async def dismiss_alert(alert_id: str):
    alerts = read_alerts()
    write_alerts([a for a in alerts if a["id"] != alert_id])
    return {"ok": True}


@router.delete("/alerts")
async def clear_alerts():
    write_alerts([])
    return {"ok": True}
