"""Intelligence Library — SQLite-backed persistent store."""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "library.db"

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS items (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL DEFAULT 'note',
    title       TEXT NOT NULL DEFAULT '',
    summary     TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL DEFAULT '{}',
    notes       TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',
    source      TEXT NOT NULL DEFAULT '',
    tlp         TEXT NOT NULL DEFAULT 'TLP:AMBER',
    verdict     TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_type       ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_verdict    ON items(verdict);
CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at DESC);
"""

_conn: sqlite3.Connection | None = None


def _get_conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(_SCHEMA_SQL)
    return conn


def _conn_() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = _get_conn()
    return _conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["tags"] = json.loads(d.get("tags") or "[]")
    d["content"] = json.loads(d.get("content") or "{}")
    return d


def create_item(
    *,
    type: str = "note",
    title: str,
    summary: str = "",
    content: dict | None = None,
    notes: str = "",
    tags: list[str] | None = None,
    source: str = "",
    tlp: str = "TLP:AMBER",
    verdict: str | None = None,
) -> dict:
    conn = _conn_()
    now = _now()
    item_id = str(uuid.uuid4())
    conn.execute(
        """INSERT INTO items
           (id, type, title, summary, content, notes, tags, source, tlp, verdict, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            item_id, type, title, summary,
            json.dumps(content or {}),
            notes,
            json.dumps(tags or []),
            source, tlp, verdict, now, now,
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    return _row(row)


def get_item(item_id: str) -> dict | None:
    row = _conn_().execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    return _row(row) if row else None


def update_item(item_id: str, **fields) -> dict | None:
    conn = _conn_()
    allowed = {"type", "title", "summary", "content", "notes", "tags", "source", "tlp", "verdict"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_item(item_id)

    set_parts: list[str] = []
    values: list[Any] = []
    for k, v in updates.items():
        set_parts.append(f"{k} = ?")
        values.append(json.dumps(v) if k in ("tags", "content") else v)
    set_parts.append("updated_at = ?")
    values.extend([_now(), item_id])

    conn.execute(f"UPDATE items SET {', '.join(set_parts)} WHERE id = ?", values)
    conn.commit()
    return get_item(item_id)


def delete_item(item_id: str) -> bool:
    conn = _conn_()
    cur = conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
    conn.commit()
    return cur.rowcount > 0


def search_items(
    *,
    q: str = "",
    type_filter: str | None = None,
    tag: str | None = None,
    verdict_filter: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[dict]:
    conn = _conn_()
    conditions: list[str] = []
    params: list[Any] = []

    if q:
        conditions.append("(title LIKE ? OR summary LIKE ? OR notes LIKE ?)")
        like = f"%{q}%"
        params.extend([like, like, like])
    if type_filter:
        conditions.append("type = ?")
        params.append(type_filter)
    if tag:
        conditions.append("EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)")
        params.append(tag)
    if verdict_filter:
        conditions.append("verdict = ?")
        params.append(verdict_filter)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.extend([limit, offset])

    rows = conn.execute(
        f"SELECT * FROM items {where} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
        params,
    ).fetchall()
    return [_row(r) for r in rows]


def get_all_tags() -> list[str]:
    rows = _conn_().execute(
        "SELECT DISTINCT value FROM items, json_each(items.tags) ORDER BY value"
    ).fetchall()
    return [r[0] for r in rows]


def count_items() -> dict[str, int]:
    conn = _conn_()
    counts: dict[str, int] = {}
    counts["all"] = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    for t in ("ioc", "actor", "note", "report"):
        counts[t] = conn.execute("SELECT COUNT(*) FROM items WHERE type = ?", (t,)).fetchone()[0]
    return counts
