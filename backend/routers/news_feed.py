"""News feed API router."""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.news_feed import (
    get_feeds, add_feed, remove_feed, toggle_feed,
    get_articles, mark_read, mark_all_read,
    get_unread_count, get_recent_articles,
)

router = APIRouter(prefix="/api/news", tags=["news"])
logger = logging.getLogger(__name__)


class AddFeedRequest(BaseModel):
    name: str
    url: str
    category: str = "news"


class ToggleFeedRequest(BaseModel):
    enabled: bool


# ── feeds ─────────────────────────────────────────────────────────────────────

@router.get("/feeds")
async def list_feeds():
    try:
        return {"feeds": get_feeds()}
    except Exception as e:
        logger.error("List feeds failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to list feeds — check server logs")


@router.post("/feeds")
async def create_feed(req: AddFeedRequest):
    try:
        feed = add_feed(req.name.strip(), req.url.strip(), req.category)
        return feed
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(409, "A feed with this URL already exists")
        logger.error("Add feed failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to add feed — check server logs")


@router.delete("/feeds/{feed_id}")
async def delete_feed(feed_id: int):
    if not remove_feed(feed_id):
        raise HTTPException(404, "Feed not found")
    return {"ok": True}


@router.put("/feeds/{feed_id}/toggle")
async def toggle(feed_id: int, req: ToggleFeedRequest):
    if not toggle_feed(feed_id, req.enabled):
        raise HTTPException(404, "Feed not found")
    return {"ok": True}


# ── refresh ───────────────────────────────────────────────────────────────────

@router.post("/refresh")
async def refresh():
    from news_checker import refresh_all_feeds

    async def _run():
        try:
            result = await refresh_all_feeds()
            logger.info("Manual refresh: %s", result)
        except Exception as e:
            logger.error("Manual refresh failed: %s", e)

    asyncio.create_task(_run())
    return {"ok": True, "message": "Refresh queued"}


# ── articles ──────────────────────────────────────────────────────────────────

@router.get("/articles")
async def list_articles(
    feed_id: int | None = None,
    unread_only: bool = False,
    limit: int = 60,
    offset: int = 0,
):
    try:
        articles = get_articles(
            feed_id=feed_id,
            unread_only=unread_only,
            limit=min(limit, 100),
            offset=offset,
        )
        return {"articles": articles, "unread_count": get_unread_count()}
    except Exception as e:
        logger.error("List articles failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to list articles — check server logs")


@router.post("/articles/{article_id}/read")
async def read_article(article_id: str):
    mark_read(article_id)
    return {"ok": True}


@router.post("/articles/read-all")
async def read_all(feed_id: int | None = None):
    count = mark_all_read(feed_id)
    return {"ok": True, "marked": count}


@router.get("/unread-count")
async def unread_count():
    return {"unread": get_unread_count()}


@router.get("/recent")
async def recent(limit: int = 8):
    try:
        return {"articles": get_recent_articles(min(limit, 20))}
    except Exception as e:
        logger.error("Recent articles failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to get recent articles — check server logs")
