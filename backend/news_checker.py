"""Background news feed poller — fetches RSS/Atom feeds with feedparser."""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from html import unescape

import feedparser
import httpx

from services.news_feed import get_feeds, save_articles, update_feed_status

logger = logging.getLogger(__name__)
_INTERVAL = 1800  # 30 minutes
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}


def _strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", " ", unescape(s or "")).strip()


def _parse_published(entry) -> str:
    try:
        tp = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
        if tp:
            dt = datetime(*tp[:6], tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            if dt > now:
                dt = now
            return dt.isoformat()
    except Exception:
        pass
    return ""


async def fetch_feed(feed_id: int, name: str, url: str, category: str) -> int:
    try:
        async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
            resp = await client.get(url, headers=_HEADERS)
            resp.raise_for_status()
            raw = resp.text

        parsed = feedparser.parse(raw)

        articles = []
        for entry in parsed.entries[:80]:
            link = entry.get("link", "").strip()
            title = _strip_html(entry.get("title", "")).strip()
            if not link or not title:
                continue
            summary_raw = entry.get("summary") or entry.get("description", "")
            summary = _strip_html(summary_raw)[:1200]
            articles.append({
                "url": link,
                "title": title,
                "summary": summary,
                "published": _parse_published(entry),
            })

        added = save_articles(feed_id, name, category, articles)
        update_feed_status(feed_id, error=None)
        if added:
            logger.info("Feed '%s': +%d new articles", name, added)
        return added

    except Exception as e:
        msg = str(e)[:200]
        logger.warning("Feed '%s' fetch failed: %s", name, msg)
        update_feed_status(feed_id, error=msg)
        return 0


async def refresh_all_feeds() -> dict:
    feeds = [f for f in get_feeds() if f["enabled"]]
    if not feeds:
        return {"fetched": 0, "new_articles": 0}

    results = await asyncio.gather(
        *[fetch_feed(f["id"], f["name"], f["url"], f["category"]) for f in feeds],
        return_exceptions=True,
    )
    new_total = sum(r for r in results if isinstance(r, int))
    return {"fetched": len(feeds), "new_articles": new_total}


async def start_checker():
    from services.news_feed import init_defaults
    init_defaults()
    logger.info("News feed checker started (interval: %ds)", _INTERVAL)
    # Fetch immediately on startup, then loop
    while True:
        try:
            result = await refresh_all_feeds()
            if result["new_articles"]:
                logger.info("News refresh complete: %d new articles from %d feeds",
                            result["new_articles"], result["fetched"])
        except Exception as e:
            logger.error("News checker loop error: %s", e)
        await asyncio.sleep(_INTERVAL)
