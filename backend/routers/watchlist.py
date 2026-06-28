import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api")

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_WATCHLIST_FILE = _DATA_DIR / "watchlist.json"

WatchItemType = Literal["ioc", "cve", "vendor", "threat_actor", "credential"]


class AddItemRequest(BaseModel):
    type: WatchItemType
    value: str
    label: str = ""


class BulkAddRequest(BaseModel):
    items: list[AddItemRequest]


def read_watchlist() -> list[dict[str, Any]]:
    try:
        if _WATCHLIST_FILE.exists():
            return json.loads(_WATCHLIST_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []


def write_watchlist(items: list[dict[str, Any]]) -> None:
    _DATA_DIR.mkdir(exist_ok=True)
    _WATCHLIST_FILE.write_text(json.dumps(items, indent=2), encoding="utf-8")


def _make_item(type_: str, value: str, label: str = "") -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "type": type_,
        "value": value.strip(),
        "label": label.strip() or value.strip(),
        "added_at": datetime.now(timezone.utc).isoformat(),
        "last_checked": None,
        "last_state": None,
        "check_interval_hours": 24 if type_ in ("vendor", "credential") else 12,
    }


@router.get("/watchlist")
async def get_watchlist():
    return {"items": read_watchlist()}


@router.post("/watchlist")
async def add_item(req: AddItemRequest):
    items = read_watchlist()
    value = req.value.strip()
    if not value:
        raise HTTPException(400, "Value cannot be empty")
    if len(items) >= 200:
        raise HTTPException(400, "Watch list limit reached (200 items)")
    if any(i["type"] == req.type and i["value"].lower() == value.lower() for i in items):
        raise HTTPException(400, f"{value} is already in the watch list")
    item = _make_item(req.type, value, req.label)
    items.append(item)
    write_watchlist(items)
    return item


@router.post("/watchlist/bulk")
async def bulk_add(req: BulkAddRequest):
    items = read_watchlist()
    added, skipped = [], []
    for r in req.items:
        value = r.value.strip()
        if not value:
            continue
        if len(items) >= 200 or any(
            i["type"] == r.type and i["value"].lower() == value.lower() for i in items
        ):
            skipped.append(value)
            continue
        item = _make_item(r.type, value, r.label)
        items.append(item)
        added.append(item)
    write_watchlist(items)
    return {"added": added, "skipped": skipped}


@router.delete("/watchlist/{item_id}")
async def remove_item(item_id: str):
    items = read_watchlist()
    new_items = [i for i in items if i["id"] != item_id]
    if len(new_items) == len(items):
        raise HTTPException(404, "Item not found")
    write_watchlist(new_items)
    return {"ok": True}


@router.delete("/watchlist")
async def clear_watchlist():
    write_watchlist([])
    return {"ok": True}


@router.post("/watchlist/{item_id}/check-now")
async def force_check(item_id: str):
    """Run an immediate check for this item and generate alerts for any changes found."""
    import httpx
    from watchlist_checker import _check_ioc, _check_cve, _check_vendor, _check_threat_actor, _check_credential
    from routers.alerts_router import create_alert

    items = read_watchlist()
    item = next((i for i in items if i["id"] == item_id), None)
    if item is None:
        raise HTTPException(404, "Item not found")

    alert_dicts: list[dict] = []
    async with httpx.AsyncClient(timeout=30) as client:
        if item["type"] == "ioc":
            alert_dicts = await _check_ioc(client, item)
        elif item["type"] == "cve":
            alert_dicts = await _check_cve(client, item)
        elif item["type"] == "vendor":
            alert_dicts = await _check_vendor(client, item)
        elif item["type"] == "threat_actor":
            alert_dicts = await _check_threat_actor(client, item)
        elif item["type"] == "credential":
            alert_dicts = await _check_credential(client, item)

    for a in alert_dicts:
        create_alert(
            item_id=item["id"],
            item_value=item["value"],
            item_type=item["type"],
            **a,
        )

    item["last_checked"] = datetime.now(timezone.utc).isoformat()
    write_watchlist(items)
    return {"ok": True, "alerts_generated": len(alert_dicts)}
