"""Client/Engagement Manager — SQLite-backed store."""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "clients.db"

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS clients (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL DEFAULT 'Unnamed Client',
    industry        TEXT NOT NULL DEFAULT '',
    engagement_ref  TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'active',
    key_assets      TEXT NOT NULL DEFAULT '',
    threat_context  TEXT NOT NULL DEFAULT '',
    contact_name    TEXT NOT NULL DEFAULT '',
    contact_email   TEXT NOT NULL DEFAULT '',
    notes           TEXT NOT NULL DEFAULT '',
    tags            TEXT NOT NULL DEFAULT '[]',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_status  ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_updated ON clients(updated_at DESC);
"""

_conn: sqlite3.Connection | None = None


def _get_conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(_SCHEMA_SQL)
    return conn


def _db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = _get_conn()
    return _conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["tags"] = json.loads(d.get("tags") or "[]")
    return d


# ── Clients ───────────────────────────────────────────────────────────────────

def list_clients(status: str | None = None, q: str | None = None) -> list[dict]:
    db = _db()
    if status and q:
        rows = db.execute(
            "SELECT * FROM clients WHERE status = ? AND (name LIKE ? OR industry LIKE ?) ORDER BY updated_at DESC",
            (status, f"%{q}%", f"%{q}%"),
        ).fetchall()
    elif status:
        rows = db.execute(
            "SELECT * FROM clients WHERE status = ? ORDER BY updated_at DESC", (status,)
        ).fetchall()
    elif q:
        rows = db.execute(
            "SELECT * FROM clients WHERE name LIKE ? OR industry LIKE ? ORDER BY updated_at DESC",
            (f"%{q}%", f"%{q}%"),
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM clients ORDER BY updated_at DESC").fetchall()
    return [_row(r) for r in rows]


def create_client(
    *,
    name: str,
    industry: str = "",
    engagement_ref: str = "",
    status: str = "active",
    key_assets: str = "",
    threat_context: str = "",
    contact_name: str = "",
    contact_email: str = "",
    notes: str = "",
    tags: list[str] | None = None,
) -> dict:
    db = _db()
    now = _now()
    cid = str(uuid.uuid4())
    db.execute(
        """INSERT INTO clients
           (id, name, industry, engagement_ref, status, key_assets, threat_context,
            contact_name, contact_email, notes, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (cid, name, industry, engagement_ref, status, key_assets, threat_context,
         contact_name, contact_email, notes, json.dumps(tags or []), now, now),
    )
    db.commit()
    return get_client(cid)  # type: ignore[return-value]


def get_client(client_id: str) -> dict | None:
    db = _db()
    row = db.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
    if not row:
        return None
    return _row(row)


def update_client(client_id: str, **fields) -> dict | None:
    db = _db()
    allowed = {
        "name", "industry", "engagement_ref", "status",
        "key_assets", "threat_context", "contact_name",
        "contact_email", "notes", "tags",
    }
    updates: dict[str, Any] = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_client(client_id)

    now = _now()
    set_parts = []
    values: list[Any] = []
    for k, v in updates.items():
        set_parts.append(f"{k} = ?")
        values.append(json.dumps(v) if k == "tags" else v)

    set_parts.append("updated_at = ?")
    values.append(now)
    values.append(client_id)

    db.execute(f"UPDATE clients SET {', '.join(set_parts)} WHERE id = ?", values)
    db.commit()
    return get_client(client_id)


def delete_client(client_id: str) -> bool:
    db = _db()
    cur = db.execute("DELETE FROM clients WHERE id = ?", (client_id,))
    db.commit()
    return cur.rowcount > 0
