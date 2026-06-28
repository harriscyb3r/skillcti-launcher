"""
SkillCTI — FastAPI Backend
Replaces proxy.py with a structured API server.
Run: uvicorn main:app --port 8765 --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from config import settings
from routers import reports, skills, anthropic_proxy, export, feeds, settings_router, enrich, cve, threat_pulse, threat_actor_spotlight, watchlist, alerts_router, domain_enum, jobs, bulk_enrich, malware_intel, breach_monitor, library, news_feed, attack, scheduler, cases, ransomware_actors, otx, abuse_ch, pir, ioc_summary, render, identity_exposure, misp, clients, ransomware_live, file_extract

app = FastAPI(title="SkillCTI API", version="2.0.0")

_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8765",
    "http://127.0.0.1:8765",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

class _SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(_SecurityHeaders)
app.include_router(reports.router)
app.include_router(skills.router)
app.include_router(anthropic_proxy.router)
app.include_router(render.router)
app.include_router(export.router)
app.include_router(feeds.router)
app.include_router(settings_router.router)
app.include_router(enrich.router)
app.include_router(cve.router)
app.include_router(threat_pulse.router)
app.include_router(threat_actor_spotlight.router)
app.include_router(watchlist.router)
app.include_router(alerts_router.router)
app.include_router(domain_enum.router)
app.include_router(jobs.router)
app.include_router(bulk_enrich.router)
app.include_router(malware_intel.router)
app.include_router(breach_monitor.router)
app.include_router(library.router)
app.include_router(news_feed.router)
app.include_router(attack.router)
app.include_router(scheduler.router)
app.include_router(cases.router)
app.include_router(ransomware_actors.router)
app.include_router(otx.router)
app.include_router(abuse_ch.router)
app.include_router(pir.router)
app.include_router(ioc_summary.router)
app.include_router(identity_exposure.router)
app.include_router(misp.router)
app.include_router(clients.router)
app.include_router(ransomware_live.router)
app.include_router(file_extract.router)


@app.on_event("startup")
async def _startup_pulse_refresh():
    """Auto-refresh threat pulse on startup if cache is stale or geography changed."""
    import asyncio
    from routers.threat_pulse import _read_cache, is_stale, generate_pulse, _write_cache

    async def _refresh():
        geography = settings.geography.strip()
        if not geography or not settings.anthropic_api_key:
            return
        cache = _read_cache()
        if cache is None or is_stale(cache) or cache.get("geography") != geography:
            try:
                result = await generate_pulse(geography)
                _write_cache(result)
                print(f"  · threat pulse refreshed for {geography}")
            except Exception as e:
                print(f"  · threat pulse refresh failed: {e}")

    asyncio.create_task(_refresh())


@app.on_event("startup")
async def _startup_watchlist_checker():
    """Start background watchlist checker loop."""
    import asyncio
    from watchlist_checker import start_checker
    asyncio.create_task(start_checker())


@app.on_event("startup")
async def _startup_spotlight_refresh():
    """Auto-refresh threat actor spotlight on startup if cache is stale."""
    import asyncio
    from routers.threat_actor_spotlight import _read_cache, is_stale, generate_spotlight, _write_cache

    async def _refresh():
        if not settings.anthropic_api_key:
            return
        cache = _read_cache()
        if cache is None or is_stale(cache):
            try:
                result = await generate_spotlight()
                _write_cache(result)
                print(f"  · threat actor spotlight refreshed: {result.get('actor_name', '?')}")
            except Exception as e:
                print(f"  · threat actor spotlight refresh failed: {e}")

    asyncio.create_task(_refresh())


@app.on_event("startup")
async def _startup_load_jobs():
    """Restore background job records from disk so they survive backend restarts."""
    from routers.jobs import load_jobs_from_disk
    load_jobs_from_disk()


@app.on_event("startup")
async def _startup_news_checker():
    """Start background news feed poller."""
    import asyncio
    from news_checker import start_checker
    asyncio.create_task(start_checker())


@app.on_event("startup")
async def _startup_attack_data():
    """Download ATT&CK STIX bundle if missing or stale."""
    import asyncio
    from services.attack import is_stale
    from routers.attack import _do_load
    if is_stale():
        asyncio.create_task(_do_load())


@app.on_event("startup")
async def _startup_scheduler():
    """Start background scheduled-reports runner."""
    import asyncio
    from scheduler_runner import start_runner
    asyncio.create_task(start_runner())


@app.get("/health")
async def health():
    return {"ok": True, "api_key_set": bool(settings.anthropic_api_key)}


if __name__ == "__main__":
    import uvicorn

    masked = (
        settings.anthropic_api_key[:12] + "..." + settings.anthropic_api_key[-4:]
        if settings.anthropic_api_key
        else "NOT SET"
    )
    print(f"\n  SkillCTI Backend (FastAPI)")
    print(f"  ─────────────────────────────────")
    print(f"  API key  : {masked}")
    print(f"  Reports  : {settings.reports_dir}")
    print(f"  Skills   : {settings.skills_root}")
    print(f"  Listening on http://localhost:{settings.port}")
    print(f"  Docs at  : http://localhost:{settings.port}/docs\n")

    uvicorn.run("main:app", host="127.0.0.1", port=settings.port, reload=True)
