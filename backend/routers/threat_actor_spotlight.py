import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

_CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
_CACHE_FILE = _CACHE_DIR / "threat_actor_spotlight.json"
_STALE_DAYS = 7
_ANTHROPIC_API = "https://api.anthropic.com"
_MODEL = "claude-sonnet-4-6"

_SYSTEM = (
    "You are a senior threat intelligence analyst. Output ONLY valid JSON with these exact keys: "
    "actor_name (string), also_known_as (array of strings), origin (string, country name), "
    "motivation (string, e.g. 'Espionage + Financial'), active_since (string, year), "
    "targets (array of sector strings, max 5), summary (2-3 sentence overview), "
    "recent_activity (2-3 sentences on activity in the past 6 months), "
    "signature_techniques (array of strings in format 'T1234 - Technique Name', max 6), "
    "notable_tools (array of malware/tool name strings, max 6), "
    "threat_level (one of: Critical, High, Medium). "
    "Choose a genuinely active, significant APT or cybercriminal group. "
    "Use real ATT&CK technique IDs. No markdown fences, no text outside the JSON object."
)


def _user_prompt() -> str:
    week = datetime.now(timezone.utc).strftime("Week of %B %d, %Y")
    return (
        f"Generate the Threat Actor of the Week spotlight for {week}. "
        "Select an APT group or major cybercriminal threat actor that has been notably active recently. "
        "Output only the JSON object."
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


async def generate_spotlight() -> dict[str, Any]:
    headers = {
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "x-api-key": settings.anthropic_api_key,
    }
    body = {
        "model": _MODEL,
        "max_tokens": 1024,
        "system": _SYSTEM,
        "messages": [{"role": "user", "content": _user_prompt()}],
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(f"{_ANTHROPIC_API}/v1/messages", json=body, headers=headers)
    resp.raise_for_status()

    resp_data = resp.json()
    usage = resp_data.get("usage", {})
    from services.api_spend import record_spend
    record_spend(
        "threat-actor-spotlight",
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
    parsed["generated_at"] = datetime.now(timezone.utc).isoformat()
    parsed["status"] = "ready"
    return parsed


@router.get("/threat-actor-spotlight")
async def get_spotlight():
    cache = _read_cache()
    if cache is None:
        return {"status": "empty"}
    return cache


@router.post("/threat-actor-spotlight/refresh")
async def refresh_spotlight():
    if not settings.anthropic_api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY is not set — configure it in Settings")
    try:
        result = await generate_spotlight()
        _write_cache(result)
        return result
    except json.JSONDecodeError as e:
        logger.error("Spotlight: model returned invalid JSON: %s", e)
        raise HTTPException(500, "Model returned unexpected output — try again")
    except httpx.HTTPStatusError as e:
        logger.error("Spotlight: Anthropic HTTP error %s", e.response.status_code)
        raise HTTPException(502, "Upstream API error — try again later")
    except Exception as e:
        logger.error("Spotlight generation failed: %s", e, exc_info=True)
        raise HTTPException(500, "Generation failed — check server logs")
