from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from config import settings, _BACKEND_DIR

router = APIRouter(prefix="/api")

_ENV_FILE = _BACKEND_DIR / ".env"

SETTING_KEYS = [
    "anthropic_api_key",
    "virustotal_api_key",
    "abuseipdb_api_key",
    "urlscan_api_key",
    "shodan_api_key",
    "threatfox_api_key",
    "hybrid_analysis_api_key",
    "hibp_api_key",
    "default_tlp",
    "geography",
]

# Keys that are always written, even when empty (non-sensitive config, not API keys)
_ALWAYS_WRITE = {"default_tlp", "geography"}


def _read_env() -> dict[str, str]:
    result: dict[str, str] = {}
    if not _ENV_FILE.exists():
        return result
    for line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        result[key.strip().lower()] = value.strip()
    return result


_MASK_CHAR = "•"  # bullet used as mask sentinel

def _mask(v: str) -> str:
    """Return a masked display value. Empty string means not configured."""
    if not v:
        return ""
    if len(v) <= 8:
        return _MASK_CHAR * 8
    return v[:4] + (_MASK_CHAR * 8) + v[-4:]

def _is_masked(v: str) -> bool:
    return _MASK_CHAR in v

def _sanitize_env_value(v: str) -> str:
    """Strip characters that would corrupt a KEY=VALUE .env line."""
    return v.replace("\n", "").replace("\r", "").replace("\x00", "")

def _write_env(data: dict[str, str]) -> None:
    lines = []
    for k, v in data.items():
        lines.append(f"{k.upper()}={_sanitize_env_value(v)}")
    _ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


class SettingsPayload(BaseModel):
    anthropic_api_key: str = ""
    virustotal_api_key: str = ""
    abuseipdb_api_key: str = ""
    urlscan_api_key: str = ""
    shodan_api_key: str = ""
    threatfox_api_key: str = ""
    hybrid_analysis_api_key: str = ""
    hibp_api_key: str = ""
    default_tlp: str = "TLP:AMBER"
    geography: str = ""


@router.get("/settings")
async def get_settings():
    env = _read_env()
    result = {}
    for k in SETTING_KEYS:
        raw = env.get(k, "")
        # Sensitive keys are masked; non-sensitive keys returned as-is
        field = next((f for f in _ALWAYS_WRITE if f == k), None)
        result[k] = raw if k in _ALWAYS_WRITE else _mask(raw)
    return result


@router.put("/settings")
async def save_settings(payload: SettingsPayload):
    current = _read_env()
    updates = payload.model_dump()
    for k, v in updates.items():
        if _is_masked(v):
            # User didn't change this key — leave the real value in .env untouched
            continue
        if k in _ALWAYS_WRITE or v != "":
            current[k] = v
    _write_env(current)
    # Reload live settings so a new key takes effect without restart
    for k, v in updates.items():
        if not _is_masked(v) and hasattr(settings, k) and v:
            object.__setattr__(settings, k, v)
    return {"ok": True}
