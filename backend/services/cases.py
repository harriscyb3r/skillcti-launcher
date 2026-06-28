"""Case Management — SQLite-backed store."""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "cases.db"

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS cases (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT 'Untitled Case',
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'open',
    priority    TEXT NOT NULL DEFAULT 'medium',
    tlp         TEXT NOT NULL DEFAULT 'TLP:AMBER',
    tags        TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    closed_at   TEXT
);

CREATE TABLE IF NOT EXISTS case_notes (
    id         TEXT PRIMARY KEY,
    case_id    TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    content    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS case_artifacts (
    id            TEXT PRIMARY KEY,
    case_id       TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL DEFAULT 'ioc',
    value         TEXT NOT NULL,
    label         TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cases_status     ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_updated    ON cases(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_case       ON case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_case   ON case_artifacts(case_id);
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


def _case_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["tags"] = json.loads(d.get("tags") or "[]")
    return d


# ── Cases ─────────────────────────────────────────────────────────────────────

def list_cases(status: str | None = None) -> list[dict]:
    db = _db()
    if status:
        rows = db.execute(
            "SELECT * FROM cases WHERE status = ? ORDER BY updated_at DESC",
            (status,),
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM cases ORDER BY updated_at DESC").fetchall()

    cases = [_case_row(r) for r in rows]
    # Attach counts
    for c in cases:
        c["note_count"] = db.execute(
            "SELECT COUNT(*) FROM case_notes WHERE case_id = ?", (c["id"],)
        ).fetchone()[0]
        c["artifact_count"] = db.execute(
            "SELECT COUNT(*) FROM case_artifacts WHERE case_id = ?", (c["id"],)
        ).fetchone()[0]
    return cases


def create_case(
    *,
    title: str,
    description: str = "",
    status: str = "open",
    priority: str = "medium",
    tlp: str = "TLP:AMBER",
    tags: list[str] | None = None,
) -> dict:
    db = _db()
    now = _now()
    cid = str(uuid.uuid4())
    db.execute(
        """INSERT INTO cases (id, title, description, status, priority, tlp, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (cid, title, description, status, priority, tlp, json.dumps(tags or []), now, now),
    )
    db.commit()
    return get_case(cid)  # type: ignore[return-value]


def get_case(case_id: str) -> dict | None:
    db = _db()
    row = db.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
    if not row:
        return None
    case = _case_row(row)
    case["notes"] = [
        dict(r) for r in db.execute(
            "SELECT * FROM case_notes WHERE case_id = ? ORDER BY created_at ASC",
            (case_id,),
        ).fetchall()
    ]
    case["artifacts"] = [
        dict(r) for r in db.execute(
            "SELECT * FROM case_artifacts WHERE case_id = ? ORDER BY created_at ASC",
            (case_id,),
        ).fetchall()
    ]
    case["note_count"] = len(case["notes"])
    case["artifact_count"] = len(case["artifacts"])
    return case


def update_case(case_id: str, **fields) -> dict | None:
    db = _db()
    allowed = {"title", "description", "status", "priority", "tlp", "tags"}
    updates: dict[str, Any] = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_case(case_id)

    now = _now()
    set_parts = []
    values: list[Any] = []

    for k, v in updates.items():
        set_parts.append(f"{k} = ?")
        values.append(json.dumps(v) if k == "tags" else v)

    set_parts.append("updated_at = ?")
    values.append(now)

    # Track closed_at when status flips to closed
    if fields.get("status") == "closed":
        set_parts.append("closed_at = ?")
        values.append(now)
    elif fields.get("status") in ("open", "in-progress"):
        set_parts.append("closed_at = ?")
        values.append(None)

    values.append(case_id)
    db.execute(f"UPDATE cases SET {', '.join(set_parts)} WHERE id = ?", values)
    db.commit()
    return get_case(case_id)


def delete_case(case_id: str) -> bool:
    db = _db()
    cur = db.execute("DELETE FROM cases WHERE id = ?", (case_id,))
    db.commit()
    return cur.rowcount > 0


# ── Notes ─────────────────────────────────────────────────────────────────────

def add_note(case_id: str, content: str) -> dict:
    db = _db()
    now = _now()
    nid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO case_notes (id, case_id, content, created_at) VALUES (?, ?, ?, ?)",
        (nid, case_id, content, now),
    )
    db.execute("UPDATE cases SET updated_at = ? WHERE id = ?", (now, case_id))
    db.commit()
    row = db.execute("SELECT * FROM case_notes WHERE id = ?", (nid,)).fetchone()
    return dict(row)


def delete_note(note_id: str) -> bool:
    db = _db()
    cur = db.execute("DELETE FROM case_notes WHERE id = ?", (note_id,))
    db.commit()
    return cur.rowcount > 0


# ── Artifacts ─────────────────────────────────────────────────────────────────

def add_artifact(case_id: str, artifact_type: str, value: str, label: str = "") -> dict:
    db = _db()
    now = _now()
    aid = str(uuid.uuid4())
    db.execute(
        """INSERT INTO case_artifacts (id, case_id, artifact_type, value, label, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (aid, case_id, artifact_type, value, label or value, now),
    )
    db.execute("UPDATE cases SET updated_at = ? WHERE id = ?", (now, case_id))
    db.commit()
    row = db.execute("SELECT * FROM case_artifacts WHERE id = ?", (aid,)).fetchone()
    return dict(row)


def delete_artifact(artifact_id: str) -> bool:
    db = _db()
    cur = db.execute("DELETE FROM case_artifacts WHERE id = ?", (artifact_id,))
    db.commit()
    return cur.rowcount > 0
