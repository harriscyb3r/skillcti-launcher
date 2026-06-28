"""Priority Intelligence Requirements — SQLite-backed store."""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "pir.db"

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS pirs (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT 'Untitled PIR',
    description     TEXT NOT NULL DEFAULT '',
    category        TEXT NOT NULL DEFAULT 'general',
    priority        TEXT NOT NULL DEFAULT 'medium',
    status          TEXT NOT NULL DEFAULT 'active',
    rescan_days     INTEGER NOT NULL DEFAULT 30,
    owner           TEXT NOT NULL DEFAULT '',
    tags            TEXT NOT NULL DEFAULT '[]',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    last_reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS pir_findings (
    id          TEXT PRIMARY KEY,
    pir_id      TEXT NOT NULL REFERENCES pirs(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    source      TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pirs_status    ON pirs(status);
CREATE INDEX IF NOT EXISTS idx_pirs_priority  ON pirs(priority);
CREATE INDEX IF NOT EXISTS idx_pirs_updated   ON pirs(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_pir   ON pir_findings(pir_id);
"""

_conn: sqlite3.Connection | None = None


def _get_conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(_SCHEMA_SQL)
    return conn


def _db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = _get_conn()
    return _conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pir_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["tags"] = json.loads(d.get("tags") or "[]")
    return d


# ── PIRs ──────────────────────────────────────────────────────────────────────

def list_pirs(
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
) -> list[dict]:
    db = _db()
    clauses = []
    params: list[Any] = []
    if status:
        clauses.append("status = ?")
        params.append(status)
    if priority:
        clauses.append("priority = ?")
        params.append(priority)
    if category:
        clauses.append("category = ?")
        params.append(category)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = db.execute(
        f"SELECT * FROM pirs {where} ORDER BY updated_at DESC",
        params,
    ).fetchall()

    pirs = [_pir_row(r) for r in rows]
    for p in pirs:
        p["finding_count"] = db.execute(
            "SELECT COUNT(*) FROM pir_findings WHERE pir_id = ?", (p["id"],)
        ).fetchone()[0]
    return pirs


def create_pir(
    *,
    title: str,
    description: str = "",
    category: str = "general",
    priority: str = "medium",
    status: str = "active",
    rescan_days: int = 30,
    owner: str = "",
    tags: list[str] | None = None,
) -> dict:
    db = _db()
    now = _now()
    pid = str(uuid.uuid4())
    db.execute(
        """INSERT INTO pirs
           (id, title, description, category, priority, status, rescan_days, owner, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (pid, title, description, category, priority, status, rescan_days,
         owner, json.dumps(tags or []), now, now),
    )
    db.commit()
    return get_pir(pid)  # type: ignore[return-value]


def get_pir(pir_id: str) -> dict | None:
    db = _db()
    row = db.execute("SELECT * FROM pirs WHERE id = ?", (pir_id,)).fetchone()
    if not row:
        return None
    pir = _pir_row(row)
    pir["findings"] = [
        dict(r) for r in db.execute(
            "SELECT * FROM pir_findings WHERE pir_id = ? ORDER BY created_at DESC",
            (pir_id,),
        ).fetchall()
    ]
    pir["finding_count"] = len(pir["findings"])
    return pir


def update_pir(pir_id: str, **fields) -> dict | None:
    db = _db()
    allowed = {"title", "description", "category", "priority", "status",
               "rescan_days", "owner", "tags", "last_reviewed_at"}
    updates: dict[str, Any] = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_pir(pir_id)

    now = _now()
    set_parts = []
    values: list[Any] = []

    for k, v in updates.items():
        set_parts.append(f"{k} = ?")
        values.append(json.dumps(v) if k == "tags" else v)

    set_parts.append("updated_at = ?")
    values.append(now)
    values.append(pir_id)

    db.execute(f"UPDATE pirs SET {', '.join(set_parts)} WHERE id = ?", values)
    db.commit()
    return get_pir(pir_id)


def delete_pir(pir_id: str) -> bool:
    db = _db()
    cur = db.execute("DELETE FROM pirs WHERE id = ?", (pir_id,))
    db.commit()
    return cur.rowcount > 0


# ── Findings ──────────────────────────────────────────────────────────────────

def add_finding(pir_id: str, content: str, source: str = "") -> dict:
    db = _db()
    now = _now()
    fid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO pir_findings (id, pir_id, content, source, created_at) VALUES (?, ?, ?, ?, ?)",
        (fid, pir_id, content, source, now),
    )
    # Update pir timestamps and last_reviewed_at
    db.execute(
        "UPDATE pirs SET updated_at = ?, last_reviewed_at = ? WHERE id = ?",
        (now, now, pir_id),
    )
    db.commit()
    row = db.execute("SELECT * FROM pir_findings WHERE id = ?", (fid,)).fetchone()
    return dict(row)


def delete_finding(finding_id: str) -> bool:
    db = _db()
    cur = db.execute("DELETE FROM pir_findings WHERE id = ?", (finding_id,))
    db.commit()
    return cur.rowcount > 0
