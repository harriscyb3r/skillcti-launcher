"""News feed service — SQLite-backed RSS/Atom article store."""
from __future__ import annotations

import hashlib
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "news.db"

DEFAULT_FEEDS = [
    # Australian Government
    {"name": "ACSC Alerts",          "url": "https://www.cyber.gov.au/rss/alerts",                                                                "category": "government"},
    {"name": "ACSC Advisories",      "url": "https://www.cyber.gov.au/rss/advisories",                                                            "category": "government"},
    # US Government
    {"name": "CISA Alerts",          "url": "https://www.cisa.gov/cybersecurity-advisories/cybersecurity-advisories.xml",                         "category": "government"},
    {"name": "CISA Current Activity","url": "https://www.cisa.gov/cybersecurity-advisories/alerts.xml",                                           "category": "government"},
    # News
    {"name": "Bleeping Computer",    "url": "https://www.bleepingcomputer.com/feed/",                                                             "category": "news"},
    {"name": "Krebs on Security",    "url": "https://krebsonsecurity.com/feed/",                                                                   "category": "news"},
    {"name": "The Hacker News",      "url": "https://feeds.feedburner.com/TheHackersNews",                                                        "category": "news"},
    {"name": "Dark Reading",         "url": "https://www.darkreading.com/rss.xml",                                                                "category": "news"},
    # Research
    {"name": "SANS ISC Diary",       "url": "https://isc.sans.edu/rssfeed_full.xml",                                                              "category": "research"},
    {"name": "Securelist",           "url": "https://securelist.com/feed/",                                                                       "category": "research"},
]

_SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS feeds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    url         TEXT UNIQUE NOT NULL,
    category    TEXT NOT NULL DEFAULT 'news',
    enabled     INTEGER NOT NULL DEFAULT 1,
    added_at    TEXT NOT NULL,
    last_fetched TEXT,
    fetch_error TEXT,
    error_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS articles (
    id          TEXT PRIMARY KEY,
    feed_id     INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    feed_name   TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'news',
    title       TEXT NOT NULL DEFAULT '',
    url         TEXT NOT NULL DEFAULT '',
    summary     TEXT NOT NULL DEFAULT '',
    published   TEXT NOT NULL DEFAULT '',
    fetched_at  TEXT NOT NULL,
    read        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_articles_feed    ON articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_time    ON articles(published DESC);
CREATE INDEX IF NOT EXISTS idx_articles_unread  ON articles(read);
"""

_conn: sqlite3.Connection | None = None


def _get_conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(_SCHEMA)
    return conn


def _c() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = _get_conn()
    return _conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _article_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()


def _feed_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["enabled"] = bool(d.get("enabled", 1))
    return d


def _article_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["read"] = bool(d.get("read", 0))
    return d


# ── feeds ─────────────────────────────────────────────────────────────────────

def init_defaults():
    conn = _c()
    count = conn.execute("SELECT COUNT(*) FROM feeds").fetchone()[0]
    if count == 0:
        now = _now()
        for f in DEFAULT_FEEDS:
            conn.execute(
                "INSERT OR IGNORE INTO feeds (name, url, category, added_at) VALUES (?, ?, ?, ?)",
                (f["name"], f["url"], f["category"], now),
            )
    else:
        # Keep default feed URLs current — update by name if URL has changed
        for f in DEFAULT_FEEDS:
            conn.execute(
                "UPDATE feeds SET url = ?, fetch_error = NULL, error_count = 0 WHERE name = ? AND url != ?",
                (f["url"], f["name"], f["url"]),
            )
    conn.commit()


def get_feeds() -> list[dict]:
    rows = _c().execute("""
        SELECT f.*,
               (SELECT COUNT(*) FROM articles a WHERE a.feed_id = f.id) AS article_count,
               (SELECT COUNT(*) FROM articles a WHERE a.feed_id = f.id AND a.read = 0) AS unread_count
        FROM feeds f ORDER BY f.category, f.name
    """).fetchall()
    return [_feed_row(r) for r in rows]


def add_feed(name: str, url: str, category: str = "news") -> dict:
    conn = _c()
    conn.execute(
        "INSERT INTO feeds (name, url, category, added_at) VALUES (?, ?, ?, ?)",
        (name, url, category, _now()),
    )
    conn.commit()
    row = conn.execute("SELECT *, 0 AS article_count, 0 AS unread_count FROM feeds WHERE url = ?", (url,)).fetchone()
    return _feed_row(row)


def remove_feed(feed_id: int) -> bool:
    conn = _c()
    cur = conn.execute("DELETE FROM feeds WHERE id = ?", (feed_id,))
    conn.commit()
    return cur.rowcount > 0


def toggle_feed(feed_id: int, enabled: bool) -> bool:
    conn = _c()
    cur = conn.execute("UPDATE feeds SET enabled = ? WHERE id = ?", (1 if enabled else 0, feed_id))
    conn.commit()
    return cur.rowcount > 0


def update_feed_status(feed_id: int, *, error: str | None = None):
    conn = _c()
    if error:
        conn.execute(
            "UPDATE feeds SET last_fetched = ?, fetch_error = ?, error_count = error_count + 1 WHERE id = ?",
            (_now(), error[:300], feed_id),
        )
    else:
        conn.execute(
            "UPDATE feeds SET last_fetched = ?, fetch_error = NULL, error_count = 0 WHERE id = ?",
            (_now(), feed_id),
        )
    conn.commit()


# ── articles ──────────────────────────────────────────────────────────────────

def save_articles(feed_id: int, feed_name: str, category: str, articles: list[dict]) -> int:
    conn = _c()
    added = 0
    now = _now()
    for a in articles:
        url = a.get("url", "")
        if not url:
            continue
        try:
            conn.execute(
                """INSERT OR IGNORE INTO articles
                   (id, feed_id, feed_name, category, title, url, summary, published, fetched_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    _article_id(url), feed_id, feed_name, category,
                    a.get("title", "")[:500],
                    url,
                    a.get("summary", "")[:1200],
                    a.get("published", ""),
                    now,
                ),
            )
            if conn.execute("SELECT changes()").fetchone()[0]:
                added += 1
        except Exception:
            pass
    conn.commit()
    # Keep most recent 400 articles per feed
    conn.execute("""
        DELETE FROM articles WHERE feed_id = ? AND id NOT IN (
            SELECT id FROM articles WHERE feed_id = ? ORDER BY fetched_at DESC LIMIT 400
        )
    """, (feed_id, feed_id))
    conn.commit()
    return added


def get_articles(
    *,
    feed_id: int | None = None,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    conds: list[str] = []
    params: list[Any] = []
    if feed_id is not None:
        conds.append("feed_id = ?")
        params.append(feed_id)
    if unread_only:
        conds.append("read = 0")
    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    params.extend([limit, offset])
    rows = _c().execute(
        f"SELECT * FROM articles {where} ORDER BY published DESC, fetched_at DESC LIMIT ? OFFSET ?",
        params,
    ).fetchall()
    return [_article_row(r) for r in rows]


def mark_read(article_id: str) -> bool:
    conn = _c()
    cur = conn.execute("UPDATE articles SET read = 1 WHERE id = ?", (article_id,))
    conn.commit()
    return cur.rowcount > 0


def mark_all_read(feed_id: int | None = None) -> int:
    conn = _c()
    if feed_id is not None:
        cur = conn.execute("UPDATE articles SET read = 1 WHERE read = 0 AND feed_id = ?", (feed_id,))
    else:
        cur = conn.execute("UPDATE articles SET read = 1 WHERE read = 0")
    conn.commit()
    return cur.rowcount


def get_unread_count() -> int:
    return _c().execute("SELECT COUNT(*) FROM articles WHERE read = 0").fetchone()[0]


def get_recent_articles(limit: int = 8) -> list[dict]:
    rows = _c().execute(
        "SELECT * FROM articles ORDER BY published DESC, fetched_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [_article_row(r) for r in rows]
