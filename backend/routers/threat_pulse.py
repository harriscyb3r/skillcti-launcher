import json
import logging
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

_CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
_CACHE_FILE = _CACHE_DIR / "threat_pulse.json"
_STALE_DAYS = 1
_ANTHROPIC_API = "https://api.anthropic.com"
_MODEL = "claude-sonnet-4-6"
_SKILL_MD = settings.skills_root / "cti-threat-pulse" / "SKILL.md"
_NEWS_DB = Path(__file__).resolve().parent.parent / "data" / "news.db"
_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

_FALLBACK_SYSTEM = (
    "You are a senior CTI analyst. Output ONLY valid JSON with keys: "
    "summary (string), threat_actors (array of name/aliases/origin/targeting/ttps/recent_activity), "
    "recent_incidents (array of date/title/summary/threat_actor), "
    "relevant_cves (array of cve_id/cvss/product/description/actively_exploited). "
    "Include 3-6 threat actors, 4-6 incidents, 3-5 CVEs. "
    "Use real ATT&CK IDs and real CVEs. No markdown fences, no text outside the JSON object."
)

# Common threat actor keywords for article filtering
_ACTOR_KEYWORDS = [
    "apt", "lazarus", "volt typhoon", "sandworm", "fancy bear", "cozy bear",
    "lockbit", "alphv", "blackcat", "clop", "bianlian", "akira", "play",
    "scattered spider", "unc", "ta", "fin", "muddywater", "turla",
    "midnight blizzard", "forest blizzard", "salt typhoon", "silk typhoon",
    "ransomware group", "threat actor", "nation-state", "espionage",
]


def _system_prompt() -> str:
    if _SKILL_MD.exists():
        return _SKILL_MD.read_text(encoding="utf-8")
    return _FALLBACK_SYSTEM


def _fetch_live_articles(geography: str, limit: int = 30) -> str:
    """Return a digest of recent feed articles relevant to the geography and threat actors."""
    if not _NEWS_DB.exists():
        return ""
    try:
        conn = sqlite3.connect(str(_NEWS_DB), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        geo_lower = geography.lower()

        # Build actor keyword LIKE clauses
        actor_conditions = " OR ".join(
            ["lower(title) LIKE ? OR lower(summary) LIKE ?"] * len(_ACTOR_KEYWORDS)
        )
        actor_params: list[Any] = []
        for kw in _ACTOR_KEYWORDS:
            actor_params.append(f"%{kw}%")
            actor_params.append(f"%{kw}%")

        rows = conn.execute(
            f"""
            SELECT title, summary, published, feed_name, category
            FROM articles
            WHERE (
                category = 'government'
                OR lower(title)   LIKE ?
                OR lower(summary) LIKE ?
                OR ({actor_conditions})
            )
            AND published >= ?
            ORDER BY
                CASE WHEN category = 'government' THEN 0 ELSE 1 END,
                published DESC
            LIMIT ?
            """,
            [f"%{geo_lower}%", f"%{geo_lower}%"] + actor_params + [cutoff, limit],
        ).fetchall()
        conn.close()

        if not rows:
            conn = sqlite3.connect(str(_NEWS_DB), check_same_thread=False)
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT title, summary, published, feed_name, category FROM articles "
                "ORDER BY published DESC LIMIT ?",
                (limit,),
            ).fetchall()
            conn.close()

        lines = []
        for r in rows:
            pub = r["published"][:10] if r["published"] else "unknown date"
            snippet = (r["summary"] or "")[:300].replace("\n", " ")
            lines.append(f"[{pub}] [{r['feed_name']}] {r['title']} — {snippet}")
        return "\n".join(lines)
    except Exception as exc:
        logger.warning("threat_pulse: could not fetch live articles: %s", exc)
        return ""


async def _fetch_kev_context(days: int = 90) -> str:
    """Return a digest of CISA KEV entries added in the past `days` days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(_KEV_URL, headers={"User-Agent": "skillcti/1.0"})
            r.raise_for_status()
        vulns = r.json().get("vulnerabilities", [])
        recent = sorted(
            [v for v in vulns if v.get("dateAdded", "") >= cutoff],
            key=lambda v: v.get("dateAdded", ""),
            reverse=True,
        )[:40]
        lines = []
        for v in recent:
            ransomware = " [RANSOMWARE]" if v.get("knownRansomwareCampaignUse", "").lower() == "known" else ""
            lines.append(
                f"{v['cveID']} (KEV added {v['dateAdded']}) — "
                f"{v.get('vendorProject', '')} {v.get('product', '')} — "
                f"{v.get('shortDescription', '')}{ransomware}"
            )
        return "\n".join(lines)
    except Exception as exc:
        logger.warning("threat_pulse: could not fetch KEV data: %s", exc)
        return ""


def _build_prompt(geography: str, articles: str, kev: str) -> str:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    articles_block = (
        f"\n\nLIVE FEED ARTICLES — incidents and threat actor activity "
        f"(derive recent_incidents and threat actor recent_activity from these):\n{articles}\n"
        if articles else ""
    )

    kev_block = (
        f"\n\nCISA KEV — confirmed actively exploited CVEs added in the last 90 days "
        f"(use these as your relevant_cves, selecting those most applicable to {geography}):\n{kev}\n"
        if kev else ""
    )

    return (
        f"Today's date is {today}. Generate a Regional Threat Pulse for: {geography}\n"
        f"{articles_block}"
        f"{kev_block}\n"
        f"Instructions:\n"
        f"1. threat_actors: identify actors actively targeting {geography}; "
        f"   set recent_activity based on the live feed articles above, not training data.\n"
        f"2. recent_incidents: derive dates, titles, and summaries directly from the feed articles; "
        f"   all incident dates must fall within the last 3 months of {today}.\n"
        f"3. relevant_cves: choose 3-5 CVEs from the CISA KEV block above that are most relevant to "
        f"   {geography} or its critical sectors; use the exact CVE IDs, products, and descriptions "
        f"   from the KEV data.\n\n"
        f"Where live data is provided above, always prefer it over training knowledge. "
        f"Use {today} as your temporal anchor — reject anything older than 3 months for incidents.\n\n"
        f"Output only the JSON object."
    )


def _read_cache() -> dict[str, Any] | None:
    try:
        if _CACHE_FILE.exists():
            return json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return None


def _write_cache(data: dict[str, Any]) -> None:
    _CACHE_DIR.mkdir(exist_ok=True)
    _CACHE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def is_stale(cache: dict[str, Any]) -> bool:
    try:
        generated = datetime.fromisoformat(cache.get("generated_at", ""))
        if generated.tzinfo is None:
            generated = generated.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - generated).days >= _STALE_DAYS
    except Exception:
        return True


async def generate_pulse(geography: str) -> dict[str, Any]:
    articles = _fetch_live_articles(geography)
    kev = await _fetch_kev_context()

    headers = {
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "x-api-key": settings.anthropic_api_key,
    }
    body = {
        "model": _MODEL,
        "max_tokens": 4096,
        "system": _system_prompt(),
        "messages": [{"role": "user", "content": _build_prompt(geography, articles, kev)}],
    }
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(f"{_ANTHROPIC_API}/v1/messages", json=body, headers=headers)
    resp.raise_for_status()

    resp_data = resp.json()
    usage = resp_data.get("usage", {})
    from services.api_spend import record_spend
    record_spend(
        "threat-pulse",
        _MODEL,
        usage.get("input_tokens", 0),
        usage.get("output_tokens", 0),
        usage.get("cache_read_input_tokens", 0),
        usage.get("cache_creation_input_tokens", 0),
    )

    text = "".join(
        block.get("text", "")
        for block in resp_data.get("content", [])
        if block.get("type") == "text"
    ).strip()

    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()

    parsed = json.loads(text)
    parsed["geography"] = geography
    parsed["generated_at"] = datetime.now(timezone.utc).isoformat()
    parsed["status"] = "ready"
    return parsed


@router.get("/threat-pulse")
async def get_threat_pulse():
    cache = _read_cache()
    current_geography = settings.geography.strip()
    if cache is None:
        return {"status": "empty", "geography": None, "current_geography": current_geography}
    return {**cache, "current_geography": current_geography}


@router.post("/threat-pulse/refresh")
async def refresh_threat_pulse():
    if not settings.anthropic_api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY is not set — configure it in Settings")
    geography = settings.geography.strip()
    if not geography:
        raise HTTPException(400, "Geography not configured — set it in Settings first")
    try:
        result = await generate_pulse(geography)
        _write_cache(result)
        return result
    except json.JSONDecodeError as e:
        logger.error("Threat pulse: model returned invalid JSON: %s", e)
        raise HTTPException(500, "Model returned unexpected output — try again")
    except httpx.HTTPStatusError as e:
        logger.error("Threat pulse: Anthropic HTTP error %s", e.response.status_code)
        raise HTTPException(502, "Upstream API error — try again later")
    except Exception as e:
        logger.error("Threat pulse generation failed: %s", e, exc_info=True)
        raise HTTPException(500, "Generation failed — check server logs")
