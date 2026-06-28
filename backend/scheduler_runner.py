"""Background scheduler — checks for due scheduled reports every 60 seconds and fires jobs."""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone

from config import settings
from services.scheduler import get_due_schedules, mark_ran
from services.format_blocks import build_system_prompt

logger = logging.getLogger(__name__)
_INTERVAL = 60  # check every minute

# Guard: track which schedule IDs are currently running so we don't double-fire
_running: set[str] = set()


async def _fire_schedule(sched: dict) -> None:
    """Build and submit a background job for one due schedule."""
    sched_id = sched["id"]
    if sched_id in _running:
        return
    _running.add(sched_id)

    try:
        # Advance the schedule's timestamps immediately so it won't be picked up again
        mark_ran(sched_id)

        # Build the system prompt blocks (reads SKILL.md from disk)
        system = build_system_prompt(
            sched["skill_path"], sched["format"], settings.skills_root
        )

        body: dict = {
            "model": sched.get("model", "claude-sonnet-4-6"),
            "max_tokens": sched.get("max_tokens", 8000),
            "system": system,
            "messages": [{"role": "user", "content": sched["user_message"]}],
        }
        if sched.get("needs_search"):
            body["tools"] = [{"type": "web_search_20250305", "name": "web_search"}]

        # Import here to avoid circular imports at module level
        from routers.jobs import create_job, JobRequest

        req = JobRequest(
            skill_id=sched["skill_id"],
            skill_name=sched["skill_name"],
            badge=sched.get("badge", "SCHEDULED"),
            badge_color=sched.get("badge_color", "#64748b"),
            format=sched["format"],
            anthropic_body=body,
        )
        result = await create_job(req)
        logger.info(
            "Scheduler fired job %s for schedule '%s' (%s)",
            result.get("job_id", "?"),
            sched["skill_name"],
            sched_id,
        )

    except FileNotFoundError as e:
        logger.error("Schedule %s: skill file not found — %s", sched_id, e)
    except Exception as e:
        logger.error("Schedule %s failed to fire: %s", sched_id, e, exc_info=True)
    finally:
        _running.discard(sched_id)


async def run_due_schedules() -> int:
    """Check for due schedules and fire them. Returns count fired."""
    due = get_due_schedules()
    if not due:
        return 0
    fired = 0
    for sched in due:
        asyncio.create_task(_fire_schedule(sched))
        fired += 1
    return fired


async def start_runner() -> None:
    """Infinite loop: check for due schedules every _INTERVAL seconds."""
    logger.info("Scheduler runner started (check interval: %ds)", _INTERVAL)
    while True:
        try:
            fired = await run_due_schedules()
            if fired:
                logger.info("Scheduler: fired %d scheduled report(s)", fired)
        except Exception as e:
            logger.error("Scheduler runner loop error: %s", e, exc_info=True)
        await asyncio.sleep(_INTERVAL)
