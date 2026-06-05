import asyncio
import logging
import re
import time

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

_kev_index: dict[str, dict] | None = None
_kev_fetched_at: float = 0.0
_KEV_TTL = 3600

CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'
_CVE_RE = re.compile(r'^CVE-\d{4}-\d{4,}$')


async def _get_kev_index(client: httpx.AsyncClient) -> dict[str, dict]:
    global _kev_index, _kev_fetched_at
    now = time.monotonic()
    if _kev_index is not None and now - _kev_fetched_at < _KEV_TTL:
        return _kev_index
    try:
        r = await client.get(CISA_KEV_URL, timeout=20)
        r.raise_for_status()
        vulns = r.json().get('vulnerabilities', [])
        _kev_index = {v['cveID']: v for v in vulns}
        _kev_fetched_at = now
    except Exception:
        if _kev_index is None:
            _kev_index = {}
    return _kev_index  # type: ignore[return-value]


def _score_to_severity(score: float) -> str:
    if score >= 9.0:
        return 'CRITICAL'
    if score >= 7.0:
        return 'HIGH'
    if score >= 4.0:
        return 'MEDIUM'
    if score > 0.0:
        return 'LOW'
    return 'NONE'


def _parse_cvss(metrics: dict) -> dict | None:
    for key in ('cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2'):
        entries = metrics.get(key, [])
        if not entries:
            continue
        entry = next((e for e in entries if e.get('type') == 'Primary'), entries[0])
        data = entry.get('cvssData', {})
        score = data.get('baseScore')
        if score is None:
            continue
        severity = (
            data.get('baseSeverity')
            or entry.get('baseSeverity')
            or _score_to_severity(float(score))
        )
        return {
            'version': data.get('version', ''),
            'score': float(score),
            'severity': severity.upper(),
            'vector': data.get('vectorString', ''),
        }
    return None


def _parse_affected(configurations: list) -> list[dict]:
    products: list[dict] = []
    seen: set[str] = set()
    for config in configurations:
        for node in config.get('nodes', []):
            for match in node.get('cpeMatch', []):
                if not match.get('vulnerable', False):
                    continue
                parts = match.get('criteria', '').split(':')
                if len(parts) >= 5:
                    vendor = parts[3].replace('_', ' ').title()
                    product = parts[4].replace('_', ' ').title()
                    k = f'{vendor}:{product}'
                    if k not in seen:
                        seen.add(k)
                        products.append({'vendor': vendor, 'product': product})
                if len(products) >= 10:
                    return products
    return products


class CVERequest(BaseModel):
    cve_id: str


@router.post('/cve')
async def lookup_cve(req: CVERequest):
    raw = req.cve_id.strip().upper()
    if not raw.startswith('CVE-'):
        raw = f'CVE-{raw}'
    if not _CVE_RE.match(raw):
        raise HTTPException(400, f'Invalid CVE ID: {raw!r}')

    async with httpx.AsyncClient(timeout=20) as client:
        async def _nvd() -> dict | None:
            try:
                r = await client.get(
                    'https://services.nvd.nist.gov/rest/json/cves/2.0',
                    params={'cveId': raw},
                    headers={'User-Agent': 'skillcti/1.0'},
                )
                if r.status_code == 404:
                    return None
                if r.status_code == 429:
                    raise HTTPException(429, 'NVD rate limit reached — try again shortly.')
                r.raise_for_status()
                d = r.json()
                return d if d.get('totalResults', 0) > 0 else None
            except HTTPException:
                raise
            except Exception as e:
                logger.error("NVD fetch failed for %s: %s", raw, e)
                raise HTTPException(502, 'NVD lookup failed — try again later')

        async def _epss() -> dict | None:
            try:
                r = await client.get(
                    'https://api.first.org/data/v1/epss',
                    params={'cve': raw},
                )
                r.raise_for_status()
                data = r.json().get('data', [])
                return data[0] if data else None
            except Exception:
                return None

        async def _kev() -> dict[str, dict]:
            return await _get_kev_index(client)

        nvd_data, epss_data, kev_idx = await asyncio.gather(
            _nvd(), _epss(), _kev(), return_exceptions=False
        )

    if not nvd_data:
        raise HTTPException(404, f'{raw} not found in NVD.')

    cve = nvd_data['vulnerabilities'][0]['cve']

    description = next(
        (d['value'] for d in cve.get('descriptions', []) if d['lang'] == 'en'),
        '',
    )
    cvss = _parse_cvss(cve.get('metrics', {}))
    affected = _parse_affected(cve.get('configurations', []))
    refs = [
        {'url': r['url'], 'tags': r.get('tags', [])}
        for r in cve.get('references', [])[:8]
    ]

    epss = None
    if epss_data:
        epss = {
            'score': float(epss_data.get('epss', 0)),
            'percentile': float(epss_data.get('percentile', 0)),
        }

    kev_entry = kev_idx.get(raw) if kev_idx else None
    kev = None
    if kev_entry:
        kev = {
            'in_catalog': True,
            'vendor': kev_entry.get('vendorProject', ''),
            'product': kev_entry.get('product', ''),
            'date_added': kev_entry.get('dateAdded', ''),
            'due_date': kev_entry.get('dueDate', ''),
            'required_action': kev_entry.get('requiredAction', ''),
            'ransomware': kev_entry.get('knownRansomwareCampaignUse', 'Unknown'),
        }

    return {
        'cve_id': raw,
        'published': cve.get('published', '')[:10],
        'modified': cve.get('lastModified', '')[:10],
        'status': cve.get('vulnStatus', ''),
        'description': description,
        'cvss': cvss,
        'epss': epss,
        'kev': kev,
        'affected': affected,
        'references': refs,
    }
