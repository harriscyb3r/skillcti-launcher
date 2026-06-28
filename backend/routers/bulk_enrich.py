"""
Bulk IOC enrichment — accepts up to 100 IOCs, enriches all via the same
multi-source pipeline as the single-IOC endpoint.
"""
import asyncio
import logging

from fastapi import APIRouter
from pydantic import BaseModel

from routers.enrich import enrich_ioc, _defang, _detect

logger = logging.getLogger(__name__)
router = APIRouter()

_MAX_IOCS = 100
_CONCURRENCY = 10


class BulkEnrichRequest(BaseModel):
    iocs: list[str]


@router.post("/bulk-enrich")
async def bulk_enrich(req: BulkEnrichRequest):
    seen: set[str] = set()
    unique: list[str] = []
    for raw in req.iocs:
        cleaned = _defang(raw.strip())
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            unique.append(cleaned)
    iocs = unique[:_MAX_IOCS]

    if not iocs:
        return {"results": [], "total": 0, "malicious": 0, "suspicious": 0, "clean": 0, "unknown": 0}

    sem = asyncio.Semaphore(_CONCURRENCY)

    async def _one(ioc: str) -> dict:
        async with sem:
            try:
                return await enrich_ioc(ioc)
            except Exception as e:
                logger.error("Bulk enrich failed for %s: %s", ioc, e)
                ioc_type = _detect(ioc)
                return {"ioc": ioc, "type": ioc_type, "verdict": "unknown", "sources": {}, "error": True}

    results = list(await asyncio.gather(*[_one(ioc) for ioc in iocs]))

    counts = {"malicious": 0, "suspicious": 0, "clean": 0, "unknown": 0}
    for r in results:
        v = r.get("verdict", "unknown")
        counts[v] = counts.get(v, 0) + 1

    return {
        "results": results,
        "total": len(results),
        **counts,
    }
