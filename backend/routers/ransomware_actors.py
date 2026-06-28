"""Curated ransomware actor profiles."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/ransomware-actors", tags=["ransomware-actors"])

_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "ransomware_actors.json"

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

_TACTIC_NAMES: dict[str, str] = {
    "reconnaissance": "Reconnaissance",
    "resource-development": "Resource Development",
    "initial-access": "Initial Access",
    "execution": "Execution",
    "persistence": "Persistence",
    "privilege-escalation": "Privilege Escalation",
    "defense-evasion": "Defense Evasion",
    "credential-access": "Credential Access",
    "discovery": "Discovery",
    "lateral-movement": "Lateral Movement",
    "collection": "Collection",
    "command-and-control": "Command and Control",
    "exfiltration": "Exfiltration",
    "impact": "Impact",
}


def _load() -> list[dict[str, Any]]:
    return json.loads(_DATA_FILE.read_text(encoding="utf-8"))


def _compute_coverage(techniques: list[dict]) -> list[dict]:
    covered: dict[str, int] = {}
    for t in techniques:
        for sn in t.get("tactic_shortnames", []):
            covered[sn] = covered.get(sn, 0) + 1
    return sorted(
        [
            {"shortname": sn, "name": _TACTIC_NAMES.get(sn, sn), "count": cnt}
            for sn, cnt in covered.items()
        ],
        key=lambda x: _TACTIC_ORDER.get(x["shortname"], 99),
    )


@router.get("")
async def list_actors(q: str = ""):
    actors = _load()
    if q:
        ql = q.lower()
        actors = [
            a for a in actors
            if ql in a["name"].lower()
            or ql in a["slug"].lower()
            or any(ql in alias.lower() for alias in a.get("aliases", []))
        ]
    return {
        "actors": [
            {
                "slug": a["slug"],
                "name": a["name"],
                "aliases": a.get("aliases", []),
                "origin": a.get("origin", ""),
                "status": a.get("status", "unknown"),
                "threat_level": a.get("threat_level", "Medium"),
                "first_seen": a.get("first_seen", ""),
                "technique_count": len(a.get("techniques", [])),
            }
            for a in actors
        ]
    }


@router.get("/{slug}")
async def get_actor(slug: str):
    actors = _load()
    actor = next((a for a in actors if a["slug"] == slug.lower()), None)
    if not actor:
        raise HTTPException(404, f"Ransomware actor '{slug}' not found")
    return {**actor, "tactic_coverage": _compute_coverage(actor.get("techniques", []))}
