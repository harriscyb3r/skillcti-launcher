"""Threat Hunt Management -- SQLite-backed store."""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "hunts.db"

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS hunts (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL DEFAULT 'Untitled Hunt',
    hypothesis       TEXT NOT NULL DEFAULT '',
    description      TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'planning',
    priority         TEXT NOT NULL DEFAULT 'medium',
    tlp              TEXT NOT NULL DEFAULT 'TLP:AMBER',
    platform         TEXT NOT NULL DEFAULT 'Microsoft Sentinel',
    timeframe        TEXT NOT NULL DEFAULT '30d',
    intel_source     TEXT NOT NULL DEFAULT '',
    mitre_techniques TEXT NOT NULL DEFAULT '[]',
    verdict          TEXT,
    tags             TEXT NOT NULL DEFAULT '[]',
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hunt_notes (
    id         TEXT PRIMARY KEY,
    hunt_id    TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
    content    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hunt_queries (
    id              TEXT PRIMARY KEY,
    hunt_id         TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
    title           TEXT NOT NULL DEFAULT '',
    phase           TEXT NOT NULL DEFAULT 'anomaly-detection',
    query_type      TEXT NOT NULL DEFAULT 'broad',
    technique_id    TEXT NOT NULL DEFAULT '',
    query_text      TEXT NOT NULL DEFAULT '',
    platform        TEXT NOT NULL DEFAULT '',
    false_positives TEXT NOT NULL DEFAULT '',
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hunt_findings (
    id             TEXT PRIMARY KEY,
    hunt_id        TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
    timestamp_utc  TEXT NOT NULL DEFAULT '',
    host           TEXT NOT NULL DEFAULT '',
    user_field     TEXT NOT NULL DEFAULT '',
    indicator      TEXT NOT NULL DEFAULT '',
    tactic         TEXT NOT NULL DEFAULT '',
    notes          TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'suspicious',
    created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hunts_status   ON hunts(status);
CREATE INDEX IF NOT EXISTS idx_hunts_updated  ON hunts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_hunt_notes     ON hunt_notes(hunt_id);
CREATE INDEX IF NOT EXISTS idx_hunt_queries   ON hunt_queries(hunt_id);
CREATE INDEX IF NOT EXISTS idx_hunt_findings  ON hunt_findings(hunt_id);
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


def _hunt_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["tags"] = json.loads(d.get("tags") or "[]")
    d["mitre_techniques"] = json.loads(d.get("mitre_techniques") or "[]")
    return d


# ── Hunts ─────────────────────────────────────────────────────────────────────

def list_hunts(status: str | None = None) -> list[dict]:
    db = _db()
    if status:
        rows = db.execute(
            "SELECT * FROM hunts WHERE status = ? ORDER BY updated_at DESC", (status,)
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM hunts ORDER BY updated_at DESC").fetchall()
    hunts = [_hunt_row(r) for r in rows]
    for h in hunts:
        h["note_count"] = db.execute(
            "SELECT COUNT(*) FROM hunt_notes WHERE hunt_id = ?", (h["id"],)
        ).fetchone()[0]
        h["query_count"] = db.execute(
            "SELECT COUNT(*) FROM hunt_queries WHERE hunt_id = ?", (h["id"],)
        ).fetchone()[0]
        h["finding_count"] = db.execute(
            "SELECT COUNT(*) FROM hunt_findings WHERE hunt_id = ?", (h["id"],)
        ).fetchone()[0]
    return hunts


def create_hunt(
    *,
    title: str,
    hypothesis: str = "",
    description: str = "",
    status: str = "planning",
    priority: str = "medium",
    tlp: str = "TLP:AMBER",
    platform: str = "Microsoft Sentinel",
    timeframe: str = "30d",
    intel_source: str = "",
    mitre_techniques: list | None = None,
    tags: list[str] | None = None,
) -> dict:
    db = _db()
    now = _now()
    hid = str(uuid.uuid4())
    db.execute(
        """INSERT INTO hunts (id, title, hypothesis, description, status, priority, tlp,
           platform, timeframe, intel_source, mitre_techniques, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            hid, title, hypothesis, description, status, priority, tlp,
            platform, timeframe, intel_source,
            json.dumps(mitre_techniques or []),
            json.dumps(tags or []),
            now, now,
        ),
    )
    db.commit()
    return get_hunt(hid)  # type: ignore[return-value]


def get_hunt(hunt_id: str) -> dict | None:
    db = _db()
    row = db.execute("SELECT * FROM hunts WHERE id = ?", (hunt_id,)).fetchone()
    if not row:
        return None
    hunt = _hunt_row(row)
    hunt["notes"] = [
        dict(r) for r in db.execute(
            "SELECT * FROM hunt_notes WHERE hunt_id = ? ORDER BY created_at ASC", (hunt_id,)
        ).fetchall()
    ]
    hunt["queries"] = [
        dict(r) for r in db.execute(
            "SELECT * FROM hunt_queries WHERE hunt_id = ? ORDER BY created_at ASC", (hunt_id,)
        ).fetchall()
    ]
    hunt["findings"] = [
        dict(r) for r in db.execute(
            "SELECT * FROM hunt_findings WHERE hunt_id = ? ORDER BY created_at ASC", (hunt_id,)
        ).fetchall()
    ]
    hunt["note_count"] = len(hunt["notes"])
    hunt["query_count"] = len(hunt["queries"])
    hunt["finding_count"] = len(hunt["findings"])
    return hunt


def update_hunt(hunt_id: str, **fields) -> dict | None:
    db = _db()
    allowed = {
        "title", "hypothesis", "description", "status", "priority", "tlp",
        "platform", "timeframe", "intel_source", "mitre_techniques", "verdict", "tags",
    }
    updates: dict[str, Any] = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_hunt(hunt_id)

    now = _now()
    set_parts: list[str] = []
    values: list[Any] = []

    for k, v in updates.items():
        set_parts.append(f"{k} = ?")
        values.append(json.dumps(v) if k in ("tags", "mitre_techniques") else v)

    set_parts.append("updated_at = ?")
    values.append(now)
    values.append(hunt_id)

    db.execute(f"UPDATE hunts SET {', '.join(set_parts)} WHERE id = ?", values)
    db.commit()
    return get_hunt(hunt_id)


def delete_hunt(hunt_id: str) -> bool:
    db = _db()
    cur = db.execute("DELETE FROM hunts WHERE id = ?", (hunt_id,))
    db.commit()
    return cur.rowcount > 0


# ── Notes ─────────────────────────────────────────────────────────────────────

def add_note(hunt_id: str, content: str) -> dict:
    db = _db()
    now = _now()
    nid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO hunt_notes (id, hunt_id, content, created_at) VALUES (?, ?, ?, ?)",
        (nid, hunt_id, content, now),
    )
    db.execute("UPDATE hunts SET updated_at = ? WHERE id = ?", (now, hunt_id))
    db.commit()
    row = db.execute("SELECT * FROM hunt_notes WHERE id = ?", (nid,)).fetchone()
    return dict(row)


def delete_note(note_id: str) -> bool:
    db = _db()
    cur = db.execute("DELETE FROM hunt_notes WHERE id = ?", (note_id,))
    db.commit()
    return cur.rowcount > 0


# ── Queries ───────────────────────────────────────────────────────────────────

def add_query(
    hunt_id: str,
    *,
    title: str,
    phase: str = "anomaly-detection",
    query_type: str = "broad",
    technique_id: str = "",
    query_text: str,
    platform: str = "",
    false_positives: str = "",
    notes: str = "",
) -> dict:
    db = _db()
    now = _now()
    qid = str(uuid.uuid4())
    db.execute(
        """INSERT INTO hunt_queries (id, hunt_id, title, phase, query_type, technique_id,
           query_text, platform, false_positives, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (qid, hunt_id, title, phase, query_type, technique_id,
         query_text, platform, false_positives, notes, now),
    )
    db.execute("UPDATE hunts SET updated_at = ? WHERE id = ?", (now, hunt_id))
    db.commit()
    row = db.execute("SELECT * FROM hunt_queries WHERE id = ?", (qid,)).fetchone()
    return dict(row)


def update_query(query_id: str, **fields) -> dict | None:
    db = _db()
    allowed = {"title", "phase", "query_type", "technique_id", "query_text",
               "platform", "false_positives", "notes"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        row = db.execute("SELECT * FROM hunt_queries WHERE id = ?", (query_id,)).fetchone()
        return dict(row) if row else None
    set_parts = [f"{k} = ?" for k in updates]
    values = list(updates.values()) + [query_id]
    db.execute(f"UPDATE hunt_queries SET {', '.join(set_parts)} WHERE id = ?", values)
    db.commit()
    row = db.execute("SELECT * FROM hunt_queries WHERE id = ?", (query_id,)).fetchone()
    return dict(row) if row else None


def delete_query(query_id: str) -> bool:
    db = _db()
    cur = db.execute("DELETE FROM hunt_queries WHERE id = ?", (query_id,))
    db.commit()
    return cur.rowcount > 0


# ── Findings ──────────────────────────────────────────────────────────────────

def add_finding(
    hunt_id: str,
    *,
    timestamp_utc: str = "",
    host: str = "",
    user_field: str = "",
    indicator: str = "",
    tactic: str = "",
    notes: str = "",
    status: str = "suspicious",
) -> dict:
    db = _db()
    now = _now()
    fid = str(uuid.uuid4())
    db.execute(
        """INSERT INTO hunt_findings (id, hunt_id, timestamp_utc, host, user_field,
           indicator, tactic, notes, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (fid, hunt_id, timestamp_utc or now[:19] + "Z", host, user_field,
         indicator, tactic, notes, status, now),
    )
    db.execute("UPDATE hunts SET updated_at = ? WHERE id = ?", (now, hunt_id))
    db.commit()
    row = db.execute("SELECT * FROM hunt_findings WHERE id = ?", (fid,)).fetchone()
    return dict(row)


def update_finding(finding_id: str, **fields) -> dict | None:
    db = _db()
    allowed = {"timestamp_utc", "host", "user_field", "indicator", "tactic", "notes", "status"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        row = db.execute("SELECT * FROM hunt_findings WHERE id = ?", (finding_id,)).fetchone()
        return dict(row) if row else None
    set_parts = [f"{k} = ?" for k in updates]
    values = list(updates.values()) + [finding_id]
    db.execute(f"UPDATE hunt_findings SET {', '.join(set_parts)} WHERE id = ?", values)
    db.commit()
    row = db.execute("SELECT * FROM hunt_findings WHERE id = ?", (finding_id,)).fetchone()
    return dict(row) if row else None


def delete_finding(finding_id: str) -> bool:
    db = _db()
    cur = db.execute("DELETE FROM hunt_findings WHERE id = ?", (finding_id,))
    db.commit()
    return cur.rowcount > 0
