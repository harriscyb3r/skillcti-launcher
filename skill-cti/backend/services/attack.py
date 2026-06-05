"""MITRE ATT&CK Enterprise — STIX bundle parser + SQLite store."""
from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "attack.db"
_BUNDLE_URL = (
    "https://raw.githubusercontent.com/mitre/cti/master/"
    "enterprise-attack/enterprise-attack.json"
)
_CACHE_DAYS = 7

# Kill-chain order for display
_TACTIC_ORDER: dict[str, int] = {
    "reconnaissance": 1,
    "resource-development": 2,
    "initial-access": 3,
    "execution": 4,
    "persistence": 5,
    "privilege-escalation": 6,
    "defense-evasion": 7,
    "credential-access": 8,
    "discovery": 9,
    "lateral-movement": 10,
    "collection": 11,
    "command-and-control": 12,
    "exfiltration": 13,
    "impact": 14,
}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tactics (
    id          TEXT PRIMARY KEY,
    attack_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    shortname   TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    position    INTEGER NOT NULL DEFAULT 99
);
CREATE TABLE IF NOT EXISTS techniques (
    id               TEXT PRIMARY KEY,
    attack_id        TEXT NOT NULL,
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    platforms        TEXT NOT NULL DEFAULT '[]',
    data_sources     TEXT NOT NULL DEFAULT '[]',
    detection        TEXT NOT NULL DEFAULT '',
    is_subtechnique  INTEGER NOT NULL DEFAULT 0,
    parent_id        TEXT,
    revoked          INTEGER NOT NULL DEFAULT 0,
    deprecated       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tech_aid    ON techniques(attack_id);
CREATE INDEX IF NOT EXISTS idx_tech_parent ON techniques(parent_id);
CREATE TABLE IF NOT EXISTS technique_tactics (
    technique_id      TEXT NOT NULL,
    tactic_shortname  TEXT NOT NULL,
    PRIMARY KEY (technique_id, tactic_shortname)
);
CREATE INDEX IF NOT EXISTS idx_tt_tactic ON technique_tactics(tactic_shortname);
CREATE TABLE IF NOT EXISTS attack_groups (
    id          TEXT PRIMARY KEY,
    attack_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    aliases     TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL DEFAULT '',
    url         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_g_aid ON attack_groups(attack_id);
CREATE TABLE IF NOT EXISTS group_techniques (
    group_id     TEXT NOT NULL,
    technique_id TEXT NOT NULL,
    PRIMARY KEY (group_id, technique_id)
);
CREATE INDEX IF NOT EXISTS idx_gt_tech  ON group_techniques(technique_id);
CREATE INDEX IF NOT EXISTS idx_gt_group ON group_techniques(group_id);
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


def _attack_id(obj: dict) -> str:
    for ref in obj.get("external_references", []):
        if ref.get("source_name") == "mitre-attack":
            return ref.get("external_id", "")
    return ""


def _mitre_url(obj: dict) -> str:
    for ref in obj.get("external_references", []):
        if ref.get("source_name") == "mitre-attack":
            return ref.get("url", "")
    return ""


# ── status ─────────────────────────────────────────────────────────────────────

def get_status() -> dict:
    conn = _c()
    row = conn.execute("SELECT value FROM meta WHERE key = 'last_updated'").fetchone()
    tech_count = conn.execute(
        "SELECT COUNT(*) FROM techniques WHERE revoked = 0 AND deprecated = 0"
    ).fetchone()[0]
    group_count = conn.execute("SELECT COUNT(*) FROM attack_groups").fetchone()[0]
    return {
        "last_updated": row[0] if row else None,
        "technique_count": tech_count,
        "group_count": group_count,
        "is_ready": tech_count > 0,
    }


def is_stale() -> bool:
    row = _c().execute("SELECT value FROM meta WHERE key = 'last_updated'").fetchone()
    if not row:
        return True
    try:
        updated = datetime.fromisoformat(row[0])
        return (datetime.now(timezone.utc) - updated).days >= _CACHE_DAYS
    except Exception:
        return True


# ── bundle loading ─────────────────────────────────────────────────────────────

def load_bundle(bundle_text: str) -> None:
    """Parse STIX 2.x bundle and populate the database. Runs synchronously (use to_thread)."""
    data = json.loads(bundle_text)
    objects: list[dict] = data.get("objects", [])
    obj_by_id: dict[str, dict] = {o["id"]: o for o in objects if "id" in o}

    conn = _c()

    # ── tactics ───────────────────────────────────────────────────────────────
    conn.execute("DELETE FROM tactics")
    for obj in objects:
        if obj.get("type") != "x-mitre-tactic":
            continue
        shortname = obj.get("x_mitre_shortname", "")
        conn.execute(
            "INSERT OR REPLACE INTO tactics (id, attack_id, name, shortname, description, position) VALUES (?,?,?,?,?,?)",
            (obj["id"], _attack_id(obj), obj.get("name", ""), shortname,
             obj.get("description", "")[:4000], _TACTIC_ORDER.get(shortname, 99)),
        )

    # ── techniques ───────────────────────────────────────────────────────────
    conn.execute("DELETE FROM techniques")
    conn.execute("DELETE FROM technique_tactics")
    for obj in objects:
        if obj.get("type") != "attack-pattern":
            continue
        aid = _attack_id(obj)
        if not aid:
            continue
        conn.execute(
            """INSERT OR REPLACE INTO techniques
               (id, attack_id, name, description, platforms, data_sources,
                detection, is_subtechnique, parent_id, revoked, deprecated)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                obj["id"], aid, obj.get("name", ""),
                obj.get("description", "")[:8000],
                json.dumps(obj.get("x_mitre_platforms", [])),
                json.dumps(obj.get("x_mitre_data_sources", [])),
                obj.get("x_mitre_detection", "")[:4000],
                1 if obj.get("x_mitre_is_subtechnique") else 0,
                None,
                1 if obj.get("revoked") else 0,
                1 if obj.get("x_mitre_deprecated") else 0,
            ),
        )
        for phase in obj.get("kill_chain_phases", []):
            if phase.get("kill_chain_name") == "mitre-attack":
                conn.execute(
                    "INSERT OR IGNORE INTO technique_tactics (technique_id, tactic_shortname) VALUES (?,?)",
                    (obj["id"], phase["phase_name"]),
                )

    # ── groups ────────────────────────────────────────────────────────────────
    conn.execute("DELETE FROM attack_groups")
    conn.execute("DELETE FROM group_techniques")
    for obj in objects:
        if obj.get("type") != "intrusion-set":
            continue
        aid = _attack_id(obj)
        if not aid:
            continue
        conn.execute(
            "INSERT OR REPLACE INTO attack_groups (id, attack_id, name, aliases, description, url) VALUES (?,?,?,?,?,?)",
            (obj["id"], aid, obj.get("name", ""),
             json.dumps(obj.get("aliases", [])),
             obj.get("description", "")[:4000],
             _mitre_url(obj)),
        )

    # ── relationships ─────────────────────────────────────────────────────────
    for obj in objects:
        if obj.get("type") != "relationship":
            continue
        rel = obj.get("relationship_type", "")
        src, tgt = obj.get("source_ref", ""), obj.get("target_ref", "")

        if rel == "uses" and not obj.get("revoked"):
            src_type = obj_by_id.get(src, {}).get("type", "")
            tgt_type = obj_by_id.get(tgt, {}).get("type", "")
            if src_type == "intrusion-set" and tgt_type == "attack-pattern":
                conn.execute(
                    "INSERT OR IGNORE INTO group_techniques (group_id, technique_id) VALUES (?,?)",
                    (src, tgt),
                )

        elif rel == "subtechnique-of":
            conn.execute(
                "UPDATE techniques SET parent_id = ? WHERE id = ?", (tgt, src)
            )

    conn.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('last_updated', ?)", (_now(),)
    )
    conn.commit()
    tech_count = conn.execute("SELECT COUNT(*) FROM techniques").fetchone()[0]
    group_count = conn.execute("SELECT COUNT(*) FROM attack_groups").fetchone()[0]
    logger.info("ATT&CK loaded: %d techniques, %d groups", tech_count, group_count)


# ── query helpers ──────────────────────────────────────────────────────────────

def _tech_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["platforms"] = json.loads(d.get("platforms") or "[]")
    d["data_sources"] = json.loads(d.get("data_sources") or "[]")
    d["is_subtechnique"] = bool(d.get("is_subtechnique"))
    d["revoked"] = bool(d.get("revoked"))
    d["deprecated"] = bool(d.get("deprecated"))
    raw = d.get("tactic_shortnames") or ""
    d["tactic_shortnames"] = [s for s in raw.split(",") if s] if raw else []
    return d


def get_tactics() -> list[dict]:
    rows = _c().execute("""
        SELECT t.*,
          (SELECT COUNT(*) FROM techniques te
           JOIN technique_tactics tt ON te.id = tt.technique_id
           WHERE tt.tactic_shortname = t.shortname
             AND te.revoked = 0 AND te.deprecated = 0
             AND te.is_subtechnique = 0) AS technique_count
        FROM tactics t ORDER BY t.position
    """).fetchall()
    return [dict(r) for r in rows]


def get_techniques(
    *,
    tactic: str | None = None,
    q: str | None = None,
    limit: int = 300,
    offset: int = 0,
) -> list[dict]:
    conds = ["te.revoked = 0", "te.deprecated = 0", "te.is_subtechnique = 0"]
    params: list[Any] = []

    if tactic:
        conds.append("te.id IN (SELECT technique_id FROM technique_tactics WHERE tactic_shortname = ?)")
        params.append(tactic)

    if q:
        conds.append("(te.attack_id LIKE ? OR te.name LIKE ?)")
        like = f"%{q}%"
        params.extend([like, like])

    where = "WHERE " + " AND ".join(conds)
    params.extend([limit, offset])

    rows = _c().execute(
        f"""SELECT te.*,
               (SELECT GROUP_CONCAT(tt.tactic_shortname)
                FROM technique_tactics tt WHERE tt.technique_id = te.id) AS tactic_shortnames
            FROM techniques te
            {where}
            ORDER BY te.attack_id LIMIT ? OFFSET ?""",
        params,
    ).fetchall()
    return [_tech_row(r) for r in rows]


def get_technique_detail(attack_id: str) -> dict | None:
    conn = _c()
    row = conn.execute(
        "SELECT * FROM techniques WHERE UPPER(attack_id) = UPPER(?)", (attack_id,)
    ).fetchone()
    if not row:
        return None

    t = _tech_row(row)

    # Tactic names
    tac_rows = conn.execute(
        """SELECT tac.name, tac.shortname, tac.attack_id FROM tactics tac
           JOIN technique_tactics tt ON tac.shortname = tt.tactic_shortname
           WHERE tt.technique_id = ? ORDER BY tac.position""",
        (t["id"],),
    ).fetchall()
    t["tactics"] = [dict(r) for r in tac_rows]
    t["tactic_shortnames"] = [r["shortname"] for r in tac_rows]

    # Sub-techniques
    sub_rows = conn.execute(
        """SELECT te.*,
               (SELECT GROUP_CONCAT(tt.tactic_shortname)
                FROM technique_tactics tt WHERE tt.technique_id = te.id) AS tactic_shortnames
           FROM techniques te WHERE te.parent_id = ? AND te.revoked = 0
           ORDER BY te.attack_id""",
        (t["id"],),
    ).fetchall()
    t["subtechniques"] = [_tech_row(r) for r in sub_rows]

    # Parent (if sub-technique)
    if t["is_subtechnique"] and t.get("parent_id"):
        p = conn.execute(
            "SELECT attack_id, name FROM techniques WHERE id = ?", (t["parent_id"],)
        ).fetchone()
        t["parent"] = dict(p) if p else None
    else:
        t["parent"] = None

    # Groups using this technique (or its subtechniques if parent)
    tech_ids = [t["id"]] + [s["id"] for s in t["subtechniques"]]
    placeholders = ",".join("?" * len(tech_ids))
    group_rows = conn.execute(
        f"""SELECT DISTINCT g.attack_id, g.name, g.aliases FROM attack_groups g
            JOIN group_techniques gt ON g.id = gt.group_id
            WHERE gt.technique_id IN ({placeholders})
            ORDER BY g.name""",
        tech_ids,
    ).fetchall()
    groups = []
    for r in group_rows:
        d = dict(r)
        d["aliases"] = json.loads(d.get("aliases") or "[]")
        groups.append(d)
    t["groups"] = groups

    return t


def get_groups(q: str | None = None, limit: int = 200) -> list[dict]:
    params: list[Any] = []
    where = ""
    if q:
        where = "WHERE name LIKE ? OR attack_id LIKE ? OR aliases LIKE ?"
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    params.append(limit)
    rows = _c().execute(
        f"SELECT * FROM attack_groups {where} ORDER BY name LIMIT ?", params
    ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["aliases"] = json.loads(d.get("aliases") or "[]")
        result.append(d)
    return result


def get_group_detail(attack_id: str) -> dict | None:
    conn = _c()
    row = conn.execute(
        "SELECT * FROM attack_groups WHERE UPPER(attack_id) = UPPER(?)", (attack_id,)
    ).fetchone()
    if not row:
        return None

    g = dict(row)
    g["aliases"] = json.loads(g.get("aliases") or "[]")
    group_internal_id = g["id"]

    # All techniques used by this group (active only)
    tech_rows = conn.execute(
        """SELECT te.id, te.attack_id, te.name, te.description, te.platforms,
                  te.is_subtechnique,
                  GROUP_CONCAT(tt.tactic_shortname) AS tactic_shortnames
           FROM techniques te
           JOIN group_techniques gt ON te.id = gt.technique_id
           LEFT JOIN technique_tactics tt ON te.id = tt.technique_id
           WHERE gt.group_id = ? AND te.revoked = 0 AND te.deprecated = 0
           GROUP BY te.id
           ORDER BY te.attack_id""",
        (group_internal_id,),
    ).fetchall()

    techniques = []
    for r in tech_rows:
        t = dict(r)
        t["platforms"] = json.loads(t.get("platforms") or "[]")
        t["is_subtechnique"] = bool(t.get("is_subtechnique"))
        t["tactic_shortnames"] = [s for s in (t.get("tactic_shortnames") or "").split(",") if s]
        techniques.append(t)

    g["techniques"] = techniques
    g["technique_count"] = len(techniques)

    # Tactic coverage ordered by kill-chain position
    tactic_rows = conn.execute(
        "SELECT shortname, name, attack_id FROM tactics ORDER BY position"
    ).fetchall()
    tactic_map: dict[str, dict] = {
        r["shortname"]: {"shortname": r["shortname"], "name": r["name"], "attack_id": r["attack_id"]}
        for r in tactic_rows
    }

    covered: dict[str, Any] = {}
    for t in techniques:
        for sn in t["tactic_shortnames"]:
            if sn not in covered:
                info = tactic_map.get(sn, {"shortname": sn, "name": sn, "attack_id": ""})
                covered[sn] = {**info, "count": 0}
            covered[sn]["count"] += 1

    g["tactic_coverage"] = sorted(
        covered.values(),
        key=lambda x: _TACTIC_ORDER.get(x["shortname"], 99),
    )

    return g
