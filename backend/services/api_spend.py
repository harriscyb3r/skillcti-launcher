"""Lightweight spend log for non-report Claude API calls (Analyst chat, Threat Pulse, Spotlight)."""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_LOG_FILE = Path(__file__).resolve().parent.parent / "cache" / "api_spend.jsonl"

_PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4":   (15.0, 75.0),
    "claude-sonnet-4": (3.0,  15.0),
    "claude-haiku-4":  (0.80,  4.0),
    "claude-opus-3":   (15.0, 75.0),
    "claude-sonnet-3": (3.0,  15.0),
    "claude-haiku-3":  (0.25,  1.25),
}


def compute_cost(
    model: str,
    input_tok: int,
    output_tok: int,
    cache_read: int = 0,
    cache_write: int = 0,
) -> float:
    base_in, base_out = next(
        (v for k, v in _PRICING.items() if model.startswith(k)),
        (3.0, 15.0),
    )
    return round(
        input_tok   * base_in  / 1_000_000
        + output_tok  * base_out / 1_000_000
        + cache_read  * base_in  * 0.10 / 1_000_000
        + cache_write * base_in  * 1.25 / 1_000_000,
        6,
    )


def record_spend(
    source: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_read: int = 0,
    cache_write: int = 0,
) -> float:
    """Append one spend entry to the JSONL log and return cost_usd."""
    cost_usd = compute_cost(model, input_tokens, output_tokens, cache_read, cache_write)
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_read_tokens": cache_read,
        "cache_write_tokens": cache_write,
        "cost_usd": cost_usd,
    }
    try:
        _LOG_FILE.parent.mkdir(exist_ok=True)
        with _LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as e:
        logger.warning("api_spend: write failed: %s", e)
    logger.info(
        "api_spend: %-22s  %s  in=%d out=%d  $%.4f",
        source, model, input_tokens, output_tokens, cost_usd,
    )
    return cost_usd


def read_spend_log() -> list[dict]:
    """Return all non-report spend entries, newest first."""
    if not _LOG_FILE.exists():
        return []
    entries: list[dict] = []
    try:
        with _LOG_FILE.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except Exception:
                        pass
    except Exception as e:
        logger.warning("api_spend: read failed: %s", e)
    return list(reversed(entries))
