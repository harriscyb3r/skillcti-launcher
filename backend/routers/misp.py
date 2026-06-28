"""
MISP (Malware Information Sharing Platform) integration.
Endpoints: /misp/status, /misp/events, /misp/event/{id}, /misp/search, /misp/context
Auth: Authorization header with automation key.
"""

import time
from datetime import date, timedelta

import httpx
from fastapi import APIRouter

from config import settings

router = APIRouter(prefix="/misp")

_status_cache: tuple[dict, float] | None = None
_STATUS_TTL = 60


def _headers() -> dict:
    return {
        "Authorization": settings.misp_api_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _base() -> str:
    return settings.misp_url.rstrip("/")


def _threat_level(level_id: int | str) -> str:
    return {1: "high", 2: "medium", 3: "low", 4: "undefined"}.get(int(level_id or 4), "undefined")


def _analysis_status(analysis_id: int | str) -> str:
    return {0: "initial", 1: "ongoing", 2: "complete"}.get(int(analysis_id or 0), "initial")


def _simplify_event(event: dict) -> dict:
    e = event.get("Event", event)
    return {
        "id": e.get("id"),
        "uuid": e.get("uuid"),
        "info": e.get("info", ""),
        "date": e.get("date", ""),
        "threat_level": _threat_level(e.get("threat_level_id", 4)),
        "analysis": _analysis_status(e.get("analysis", 0)),
        "attribute_count": int(e.get("attribute_count") or 0),
        "org": (e.get("Org") or {}).get("name", "") or (e.get("orgc") or {}).get("name", ""),
        "tags": [t.get("name", "") for t in e.get("Tag", [])[:6]],
    }


async def _misp_enrich(client: httpx.AsyncClient, ioc: str, ioc_type: str) -> dict:
    """Importable helper for enrich.py — searches MISP attributes for the given IOC."""
    if not settings.misp_url or not settings.misp_api_key:
        return {"status": "no_key"}
    if ioc_type == "unknown":
        return {"status": "unsupported"}

    _type_map = {
        "ip":     ["ip-dst", "ip-src"],
        "domain": ["domain", "hostname"],
        "url":    ["url", "uri"],
        "md5":    ["md5"],
        "sha1":   ["sha1"],
        "sha256": ["sha256"],
    }
    misp_types = _type_map.get(ioc_type)

    try:
        # Use own client to support verify=False for self-signed certs on local MISP
        async with httpx.AsyncClient(timeout=15, verify=False) as _client:
            payload: dict = {
                "value": ioc,
                "limit": 20,
                "includeContext": True,
                "returnFormat": "json",
            }
            if misp_types:
                payload["type"] = misp_types

            r = await _client.post(
                f"{_base()}/attributes/restSearch",
                headers=_headers(),
                json=payload,
            )

        if r.status_code in (401, 403):
            return {"status": "bad_key"}
        r.raise_for_status()

        attributes = r.json().get("response", {}).get("Attribute", [])
        if not attributes:
            return {"status": "not_found", "verdict": "unknown", "event_count": 0}

        seen_event_ids: set = set()
        events = []
        for attr in attributes:
            event = attr.get("Event", {})
            eid = event.get("id")
            if eid and eid not in seen_event_ids:
                seen_event_ids.add(eid)
                threat_id = int(event.get("threat_level_id") or 4)
                events.append({
                    "id": eid,
                    "info": event.get("info", ""),
                    "date": event.get("date", ""),
                    "threat_level": _threat_level(threat_id),
                    "org": event.get("org", ""),
                    "_threat_id": threat_id,
                })

        min_threat = min((e["_threat_id"] for e in events), default=4)
        if min_threat == 1:
            verdict = "malicious"
        elif min_threat in (2, 3):
            verdict = "suspicious"
        else:
            verdict = "unknown"

        tags = list({
            t.get("name", "")
            for attr in attributes
            for t in attr.get("Tag", [])
            if t.get("name")
        })[:8]

        return {
            "status": "ok",
            "verdict": verdict,
            "event_count": len(seen_event_ids),
            "attribute_count": len(attributes),
            "events": [
                {
                    "id": e["id"],
                    "info": e["info"],
                    "date": e["date"],
                    "threat_level": e["threat_level"],
                    "org": e["org"],
                }
                for e in events[:5]
            ],
            "tags": tags,
            "link": f"{_base()}/attributes/index/attributeFilter:{ioc}",
        }

    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


@router.get("/status")
async def misp_status():
    global _status_cache
    if not settings.misp_url or not settings.misp_api_key:
        return {"status": "no_key"}
    now = time.monotonic()
    if _status_cache and now - _status_cache[1] < _STATUS_TTL:
        return _status_cache[0]
    try:
        async with httpx.AsyncClient(timeout=10, verify=False) as client:
            r = await client.get(f"{_base()}/servers/getVersion", headers=_headers())
            if r.status_code in (401, 403):
                return {"status": "bad_key"}
            r.raise_for_status()
            d = r.json()
            result = {
                "status": "ok",
                "version": d.get("version", ""),
                "perm_auth": d.get("perm_auth", False),
                "url": settings.misp_url,
            }
            _status_cache = (result, now)
            return result
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


@router.get("/events")
async def misp_events(limit: int = 50, page: int = 1):
    """Return recent MISP events."""
    if not settings.misp_url or not settings.misp_api_key:
        return {"status": "no_key", "events": []}
    try:
        async with httpx.AsyncClient(timeout=20, verify=False) as client:
            r = await client.post(
                f"{_base()}/events/restSearch",
                headers=_headers(),
                json={"limit": limit, "page": page, "returnFormat": "json"},
            )
            if r.status_code in (401, 403):
                return {"status": "bad_key", "events": []}
            r.raise_for_status()
            events = r.json().get("response", [])
            return {
                "status": "ok",
                "events": [_simplify_event(e) for e in events],
            }
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200], "events": []}


@router.get("/event/{event_id}")
async def misp_event(event_id: str):
    """Return a single MISP event with its attributes."""
    if not settings.misp_url or not settings.misp_api_key:
        return {"status": "no_key"}
    try:
        async with httpx.AsyncClient(timeout=15, verify=False) as client:
            r = await client.get(f"{_base()}/events/view/{event_id}", headers=_headers())
            if r.status_code == 404:
                return {"status": "not_found"}
            if r.status_code in (401, 403):
                return {"status": "bad_key"}
            r.raise_for_status()
            d = r.json()
            event = d.get("Event", d)
            return {
                "status": "ok",
                "event": _simplify_event(d),
                "attributes": [
                    {
                        "id": a.get("id"),
                        "type": a.get("type"),
                        "category": a.get("category"),
                        "value": a.get("value"),
                        "comment": a.get("comment", ""),
                        "timestamp": a.get("timestamp"),
                        "tags": [t.get("name") for t in a.get("Tag", [])],
                    }
                    for a in event.get("Attribute", [])[:100]
                ],
            }
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


def _format_misp_context(events: list, skill_type: str, query: str = "") -> str:
    """Format MISP events into structured intelligence text for LLM prompt injection."""
    THREAT_LABELS: dict[str, str] = {"1": "HIGH", "2": "MEDIUM", "3": "LOW", "4": "UNDEFINED"}
    IOC_TYPES = {"ip-dst", "ip-src", "domain", "hostname", "url", "md5", "sha256", "sha1"}

    header_parts = [f"Events included: {len(events)}"]
    if query:
        header_parts.append(f"Search query: {query}")

    lines: list[str] = [
        "══════════════════════════════════════════════════════════",
        "PROPRIETARY MISP THREAT INTELLIGENCE",
        "Source: Local MISP instance (curated, organisation-specific)",
        "  ".join(header_parts),
        "══════════════════════════════════════════════════════════",
        "",
        "Incorporate the following MISP intelligence into your analysis where relevant.",
        "This is curated proprietary intelligence — weight it accordingly alongside open-source findings.",
        "",
    ]

    def fmt_event(evt_wrapper: dict) -> list[str]:
        e = evt_wrapper.get("Event", evt_wrapper)
        threat_id = str(e.get("threat_level_id") or "4")
        label = THREAT_LABELS.get(threat_id, "UNDEFINED")
        info = e.get("info", "(untitled)")
        date_str = e.get("date", "unknown")
        org = ((e.get("Orgc") or e.get("Org") or {}).get("name", "")) or str(e.get("org_id", ""))
        attr_count = int(e.get("attribute_count") or len(e.get("Attribute", [])) or 0)

        # Tags: handle both EventTag[].Tag.name and Tag[].name shapes
        raw_tags = e.get("EventTag") or e.get("Tag") or []
        tag_names: list[str] = []
        for t in raw_tags:
            name = (t.get("Tag") or {}).get("name") or t.get("name") or ""
            if name and name not in tag_names:
                tag_names.append(name)

        block = [f"### [{label}] {info}"]
        block.append(f"Date: {date_str}  |  Org: {org}  |  Indicators: {attr_count}")
        if tag_names:
            block.append(f"Tags: {', '.join(tag_names[:8])}")

        # Key IOCs from embedded attributes
        attributes = e.get("Attribute", [])
        iocs = [a for a in attributes if a.get("type") in IOC_TYPES][:8]
        if iocs:
            block.append("Key indicators:")
            for a in iocs:
                block.append(f"  - [{a.get('type')}] {a.get('value', '')}")

        return block

    # Sort: high (1) → medium (2) → low (3) → undefined (4)
    sorted_events = sorted(
        events,
        key=lambda ev: int((ev.get("Event", ev)).get("threat_level_id") or 4),
    )

    for evt in sorted_events:
        lines.extend(fmt_event(evt))
        lines.append("")

    lines += [
        "══════════════════════════════════════════════════════════",
        "END OF MISP INTELLIGENCE CONTEXT",
        "══════════════════════════════════════════════════════════",
    ]
    return "\n".join(lines)


@router.get("/context")
async def misp_context(
    skill_type: str = "operational",
    query: str = "",
    days: int = 30,
):
    """Return recent MISP events formatted as structured intelligence text for prompt injection.

    skill_type: operational | tactical | strategic | daily | sector | threat-actor | advisory
    query:      free-text search term (required for threat-actor, advisory, sector)
    days:       look-back window in calendar days
    """
    if not settings.misp_url or not settings.misp_api_key:
        return {"context": None, "event_count": 0, "has_data": False}

    from_date = (date.today() - timedelta(days=days)).isoformat()

    search_params: dict = {
        "returnFormat": "json",
        "limit": 20,
        "page": 1,
        "from": from_date,
    }

    if skill_type in ("operational", "tactical"):
        search_params["threat_level_id"] = [1, 2]
    elif skill_type == "strategic":
        search_params["threat_level_id"] = [1, 2, 3]
        search_params["limit"] = 25
    elif skill_type == "daily":
        search_params["threat_level_id"] = [1, 2]
        search_params["limit"] = 10
    elif skill_type in ("threat-actor", "advisory", "sector"):
        if not query.strip():
            return {"context": None, "event_count": 0, "has_data": False}
        search_params["searchall"] = query.strip()
        search_params["limit"] = 15

    try:
        async with httpx.AsyncClient(timeout=20, verify=False) as client:
            r = await client.post(
                f"{_base()}/events/restSearch",
                headers=_headers(),
                json=search_params,
            )
            if r.status_code in (401, 403):
                return {"context": None, "event_count": 0, "has_data": False}
            r.raise_for_status()
            events = r.json().get("response", [])
    except Exception as exc:
        return {"context": None, "event_count": 0, "has_data": False, "error": str(exc)[:200]}

    if not events:
        return {"context": None, "event_count": 0, "has_data": False}

    context = _format_misp_context(events, skill_type, query)
    return {"context": context, "event_count": len(events), "has_data": True}


@router.get("/search")
async def misp_search(q: str, limit: int = 20):
    """Free-text search across MISP events."""
    if not settings.misp_url or not settings.misp_api_key:
        return {"status": "no_key", "events": []}
    if not q.strip():
        return {"status": "error", "detail": "q required", "events": []}
    try:
        async with httpx.AsyncClient(timeout=20, verify=False) as client:
            r = await client.post(
                f"{_base()}/events/restSearch",
                headers=_headers(),
                json={"searchall": q.strip(), "limit": limit, "returnFormat": "json"},
            )
            if r.status_code in (401, 403):
                return {"status": "bad_key", "events": []}
            r.raise_for_status()
            events = r.json().get("response", [])
            return {
                "status": "ok",
                "query": q,
                "events": [_simplify_event(e) for e in events],
            }
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200], "events": []}
