import json
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse

from config import settings
from services.style_rule import inject_style_rule

router = APIRouter()

ANTHROPIC_API = "https://api.anthropic.com"
ANTHROPIC_HEADERS = {
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "web-search-2025-03-05",
}


def _make_headers() -> dict:
    return {
        **ANTHROPIC_HEADERS,
        "Content-Type": "application/json",
        "x-api-key": settings.anthropic_api_key,
    }


def _log_usage(data: dict) -> None:
    usage = data.get("usage") or {}
    if not usage:
        return
    fresh   = usage.get("input_tokens", 0)
    written = usage.get("cache_creation_input_tokens", 0)
    read    = usage.get("cache_read_input_tokens", 0)
    out     = usage.get("output_tokens", 0)
    total_in = fresh + written + read
    pct = (read / total_in * 100) if total_in else 0
    if written and not read:
        tag = f"CACHE MISS · wrote {written:,} tokens"
    elif read:
        tag = f"CACHE HIT  · {pct:.0f}% ({read:,}/{total_in:,})"
    else:
        tag = "no cache"
    print(f"  · usage: in={total_in:,} out={out:,} · {tag}")


async def _sse_stream(body: bytes) -> AsyncGenerator[str, None]:
    """Forward Anthropic SSE stream to the browser as SSE."""
    target = f"{ANTHROPIC_API}/v1/messages"
    headers = _make_headers()

    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream("POST", target, content=body, headers=headers) as resp:
            if resp.status_code != 200:
                error_body = await resp.aread()
                yield f"data: {error_body.decode()}\n\n"
                return
            async for line in resp.aiter_lines():
                if not line:
                    yield "\n"
                    continue
                yield f"{line}\n"
                # Log usage from message_delta events
                if line.startswith("data:"):
                    try:
                        payload = json.loads(line[5:].strip())
                        if payload.get("type") == "message_delta":
                            _log_usage(payload.get("usage", {}))
                    except Exception:
                        pass


@router.post("/chat/stream")
async def stream_chat(request: Request):
    """Freeform analyst chat — same streaming pipeline, no style-rule injection."""
    if not settings.anthropic_api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY is not set. Configure it in Settings.")

    raw = await request.body()
    try:
        payload = json.loads(raw)
        payload["stream"] = True
        raw = json.dumps(payload).encode()
    except Exception:
        raise HTTPException(400, "invalid JSON body")

    return StreamingResponse(
        _sse_stream(raw),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/v1/messages/stream")
async def stream_anthropic(request: Request):
    if not settings.anthropic_api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY is not set. Configure it in Settings.")

    raw = await request.body()
    # Ensure stream=true is set in the body
    try:
        payload = json.loads(raw)
        payload["stream"] = True
        raw = json.dumps(payload).encode()
    except Exception:
        raise HTTPException(400, "invalid JSON body")

    raw = inject_style_rule(raw)

    return StreamingResponse(
        _sse_stream(raw),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


_ALLOWED_PATHS = {"messages", "messages/stream", "messages/batches"}

@router.post("/v1/{path:path}")
async def proxy_anthropic(path: str, request: Request):
    if path not in _ALLOWED_PATHS:
        raise HTTPException(404, "Not found")
    if not settings.anthropic_api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY is not set. Configure it in Settings.")

    body = await request.body()
    body = inject_style_rule(body)

    target = f"{ANTHROPIC_API}/v1/{path}"

    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(target, content=body, headers=_make_headers())

    try:
        _log_usage(resp.json())
    except Exception:
        pass

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type="application/json",
    )
