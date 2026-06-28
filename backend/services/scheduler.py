"""Scheduled Reports — SQLite-backed schedule store."""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "scheduler.db"

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS schedules (
    id              TEXT PRIMARY KEY,
    skill_id        TEXT NOT NULL,
    skill_name      TEXT NOT NULL,
    skill_path      TEXT NOT NULL,
    badge           TEXT NOT NULL DEFAULT '',
    badge_color     TEXT NOT NULL DEFAULT '#64748b',
    user_message    TEXT NOT NULL,
    format          TEXT NOT NULL DEFAULT 'html',
    model           TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    max_tokens      INTEGER NOT NULL DEFAULT 8000,
    needs_search    INTEGER NOT NULL DEFAULT 1,
    frequency       TEXT NOT NULL DEFAULT 'daily',
    hour            INTEGER NOT NULL DEFAULT 8,
    day_of_week     INTEGER,
    day_of_month    INTEGER,
    enabled         INTEGER NOT NULL DEFAULT 1,
    last_run        TEXT,
    next_run        TEXT NOT NULL,
    created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run);
CREATE INDEX IF NOT EXISTS idx_schedules_enabled  ON schedules(enabled);
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
    d["enabled"] = bool(d.get("enabled", 1))
    d["needs_search"] = bool(d.get("needs_search", 1))
    return d


def compute_next_run(
    frequency: str,
    hour: int,
    day_of_week: int | None,
    day_of_month: int | None,
    after: datetime | None = None,
) -> datetime:
    """Return the next UTC datetime the schedule should fire."""
    now = after or datetime.now(timezone.utc)
    # Candidate: today at the scheduled hour (minute/second zeroed)
    candidate = now.replace(minute=0, second=0, microsecond=0, hour=hour)

    if frequency == "daily":
        if candidate <= now:
            candidate += timedelta(days=1)
        return candidate

    elif frequency == "weekly":
        dow = day_of_week if day_of_week is not None else 0  # Monday default
        # days_ahead: how many days until next occurrence of `dow`
        days_ahead = (dow - candidate.weekday()) % 7
        if days_ahead == 0 and candidate <= now:
            days_ahead = 7
        candidate += timedelta(days=days_ahead)
        return candidate

    elif frequency == "monthly":
        dom = day_of_month if day_of_month is not None else 1
        dom = min(dom, 28)  # clamp to 28 to avoid month-length issues
        try:
            candidate = candidate.replace(day=dom)
        except ValueError:
            candidate = candidate.replace(day=1)
        if candidate <= now:
            # Move to next month
            first_next = (candidate.replace(day=1) + timedelta(days=32)).replace(day=1)
            candidate = first_next.replace(day=dom)
        return candidate

    # Fallback: daily
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def create_schedule(
    *,
    skill_id: str,
    skill_name: str,
    skill_path: str,
    badge: str = "",
    badge_color: str = "#64748b",
    user_message: str,
    format: str = "html",
    model: str = "claude-sonnet-4-6",
    max_tokens: int = 8000,
    needs_search: bool = True,
    frequency: str = "daily",
    hour: int = 8,
    day_of_week: int | None = None,
    day_of_month: int | None = None,
    enabled: bool = True,
) -> dict:
    conn = _conn_()
    now = _now()
    sched_id = str(uuid.uuid4())
    next_run = compute_next_run(frequency, hour, day_of_week, day_of_month)
    conn.execute(
        """INSERT INTO schedules
           (id, skill_id, skill_name, skill_path, badge, badge_color,
            user_message, format, model, max_tokens, needs_search,
            frequency, hour, day_of_week, day_of_month, enabled,
            last_run, next_run, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            sched_id, skill_id, skill_name, skill_path, badge, badge_color,
            user_message, format, model, max_tokens, int(needs_search),
            frequency, hour, day_of_week, day_of_month, int(enabled),
            None, next_run.isoformat(), now,
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM schedules WHERE id = ?", (sched_id,)).fetchone()
    return _row(row)


def list_schedules() -> list[dict]:
    rows = _conn_().execute(
        "SELECT * FROM schedules ORDER BY created_at DESC"
    ).fetchall()
    return [_row(r) for r in rows]


def get_schedule(sched_id: str) -> dict | None:
    row = _conn_().execute(
        "SELECT * FROM schedules WHERE id = ?", (sched_id,)
    ).fetchone()
    return _row(row) if row else None


def update_schedule(sched_id: str, **fields) -> dict | None:
    conn = _conn_()
    allowed = {
        "user_message", "format", "model", "max_tokens", "needs_search",
        "frequency", "hour", "day_of_week", "day_of_month", "enabled",
    }
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_schedule(sched_id)

    # Recompute next_run if schedule timing changed
    current = get_schedule(sched_id)
    if not current:
        return None

    set_parts: list[str] = []
    values: list[Any] = []
    for k, v in updates.items():
        set_parts.append(f"{k} = ?")
        if k in ("enabled", "needs_search"):
            values.append(int(v))
        else:
            values.append(v)

    # If any timing field changed, recompute next_run
    timing_keys = {"frequency", "hour", "day_of_week", "day_of_month"}
    if timing_keys & set(updates.keys()):
        merged = {**current, **updates}
        next_run = compute_next_run(
            merged.get("frequency", "daily"),
            merged.get("hour", 8),
            merged.get("day_of_week"),
            merged.get("day_of_month"),
        )
        set_parts.append("next_run = ?")
        values.append(next_run.isoformat())

    values.append(sched_id)
    conn.execute(f"UPDATE schedules SET {', '.join(set_parts)} WHERE id = ?", values)
    conn.commit()
    return get_schedule(sched_id)


def mark_ran(sched_id: str) -> dict | None:
    """Update last_run to now and advance next_run by one period."""
    sched = get_schedule(sched_id)
    if not sched:
        return None
    now = datetime.now(timezone.utc)
    next_run = compute_next_run(
        sched["frequency"], sched["hour"],
        sched.get("day_of_week"), sched.get("day_of_month"),
        after=now,
    )
    conn = _conn_()
    conn.execute(
        "UPDATE schedules SET last_run = ?, next_run = ? WHERE id = ?",
        (now.isoformat(), next_run.isoformat(), sched_id),
    )
    conn.commit()
    return get_schedule(sched_id)


def delete_schedule(sched_id: str) -> bool:
    conn = _conn_()
    cur = conn.execute("DELETE FROM schedules WHERE id = ?", (sched_id,))
    conn.commit()
    return cur.rowcount > 0


def get_due_schedules() -> list[dict]:
    """Return all enabled schedules whose next_run is <= now."""
    now = datetime.now(timezone.utc).isoformat()
    rows = _conn_().execute(
        "SELECT * FROM schedules WHERE enabled = 1 AND next_run <= ?",
        (now,),
    ).fetchall()
    return [_row(r) for r in rows]
