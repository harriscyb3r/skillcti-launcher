import asyncio
import base64
import re
from urllib.parse import quote

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from config import settings
from routers.misp import _misp_enrich

router = APIRouter()

_IP_RE = re.compile(r'^\d{1,3}(\.\d{1,3}){3}$')
_MD5_RE = re.compile(r'^[a-fA-F0-9]{32}$')
_SHA1_RE = re.compile(r'^[a-fA-F0-9]{40}$')
_SHA256_RE = re.compile(r'^[a-fA-F0-9]{64}$')


def _defang(ioc: str) -> str:
    return (
        ioc.replace('hxxps://', 'https://')
           .replace('hxxp://', 'http://')
           .replace('[.]', '.')
           .replace('[:]', ':')
    )


def _detect(ioc: str) -> str:
    if _IP_RE.match(ioc):
        return 'ip'
    if _SHA256_RE.match(ioc):
        return 'sha256'
    if _SHA1_RE.match(ioc):
        return 'sha1'
    if _MD5_RE.match(ioc):
        return 'md5'
    if ioc.startswith(('http://', 'https://')):
        return 'url'
    if '.' in ioc and ' ' not in ioc and len(ioc) < 253:
        return 'domain'
    return 'unknown'


def _vt_verdict(stats: dict) -> str:
    m = stats.get('malicious', 0)
    s = stats.get('suspicious', 0)
    if m >= 3:
        return 'malicious'
    if m >= 1 or s >= 3:
        return 'suspicious'
    return 'clean'


async def _vt(client: httpx.AsyncClient, ioc: str, ioc_type: str) -> dict:
    if not settings.virustotal_api_key:
        return {'status': 'no_key'}

    h = {'x-apikey': settings.virustotal_api_key}
    base = 'https://www.virustotal.com/api/v3'

    try:
        if ioc_type == 'ip':
            r = await client.get(f'{base}/ip_addresses/{ioc}', headers=h)
        elif ioc_type == 'domain':
            r = await client.get(f'{base}/domains/{ioc}', headers=h)
        elif ioc_type in ('md5', 'sha1', 'sha256'):
            r = await client.get(f'{base}/files/{ioc}', headers=h)
        elif ioc_type == 'url':
            uid = base64.urlsafe_b64encode(ioc.encode()).decode().rstrip('=')
            r = await client.get(f'{base}/urls/{uid}', headers=h)
        else:
            return {'status': 'unsupported'}

        if r.status_code == 404:
            return {'status': 'not_found'}
        if r.status_code in (401, 403):
            return {'status': 'bad_key'}
        r.raise_for_status()

        attr = r.json()['data']['attributes']
        stats = attr.get('last_analysis_stats', {})
        total = sum(stats.values())
        malicious = stats.get('malicious', 0)
        suspicious = stats.get('suspicious', 0)
        verdict = _vt_verdict(stats)

        result: dict = {
            'status': 'ok',
            'verdict': verdict,
            'malicious': malicious,
            'suspicious': suspicious,
            'total': total,
        }

        if ioc_type == 'ip':
            result.update({
                'country': attr.get('country', ''),
                'as_owner': attr.get('as_owner', ''),
                'link': f'https://www.virustotal.com/gui/ip-address/{ioc}',
            })
        elif ioc_type == 'domain':
            result.update({
                'categories': list(attr.get('categories', {}).values())[:3],
                'link': f'https://www.virustotal.com/gui/domain/{ioc}',
            })
        elif ioc_type in ('md5', 'sha1', 'sha256'):
            result.update({
                'file_name': attr.get('meaningful_name', ''),
                'file_type': attr.get('type_description', ''),
                'link': f'https://www.virustotal.com/gui/file/{ioc}',
            })
        elif ioc_type == 'url':
            uid = base64.urlsafe_b64encode(ioc.encode()).decode().rstrip('=')
            result['link'] = f'https://www.virustotal.com/gui/url/{uid}'

        return result
    except Exception as e:
        return {'status': 'error', 'detail': str(e)[:200]}


async def _abuseipdb(client: httpx.AsyncClient, ioc: str, ioc_type: str) -> dict:
    if ioc_type != 'ip':
        return {'status': 'unsupported'}
    if not settings.abuseipdb_api_key:
        return {'status': 'no_key'}

    try:
        r = await client.get(
            'https://api.abuseipdb.com/api/v2/check',
            params={'ipAddress': ioc, 'maxAgeInDays': 90},
            headers={'Key': settings.abuseipdb_api_key, 'Accept': 'application/json'},
        )
        r.raise_for_status()
        d = r.json()['data']
        score = d.get('abuseConfidenceScore', 0)

        if score >= 50:
            verdict = 'malicious'
        elif score >= 10:
            verdict = 'suspicious'
        else:
            verdict = 'clean'

        return {
            'status': 'ok',
            'verdict': verdict,
            'score': score,
            'total_reports': d.get('totalReports', 0),
            'country': d.get('countryCode', ''),
            'isp': d.get('isp', ''),
            'usage_type': d.get('usageType', ''),
            'is_tor': d.get('isTor', False),
            'link': f'https://www.abuseipdb.com/check/{ioc}',
        }
    except Exception as e:
        return {'status': 'error', 'detail': str(e)[:200]}


async def _urlscan(client: httpx.AsyncClient, ioc: str, ioc_type: str) -> dict:
    if ioc_type not in ('domain', 'url'):
        return {'status': 'unsupported'}
    if not settings.urlscan_api_key:
        return {'status': 'no_key'}

    try:
        q = f'domain:{ioc}' if ioc_type == 'domain' else f'page.url:"{ioc}"'
        r = await client.get(
            'https://urlscan.io/api/v1/search/',
            params={'q': q, 'size': 1},
            headers={'API-Key': settings.urlscan_api_key},
        )
        if r.status_code == 429:
            return {'status': 'error', 'detail': 'Rate limited'}
        r.raise_for_status()

        results = r.json().get('results', [])
        if not results:
            return {'status': 'not_found'}

        hit = results[0]
        ov = hit.get('verdicts', {}).get('overall', {})
        malicious = ov.get('malicious', False)
        score = ov.get('score', 0)
        tags = ov.get('tags', [])

        return {
            'status': 'ok',
            'verdict': 'malicious' if malicious else ('suspicious' if score > 0 else 'clean'),
            'malicious': malicious,
            'score': score,
            'tags': tags[:5],
            'link': hit.get('result', ''),
        }
    except Exception as e:
        return {'status': 'error', 'detail': str(e)[:200]}


async def _shodan(client: httpx.AsyncClient, ioc: str, ioc_type: str) -> dict:
    if ioc_type != 'ip':
        return {'status': 'unsupported'}
    if not settings.shodan_api_key:
        return {'status': 'no_key'}

    try:
        r = await client.get(
            f'https://api.shodan.io/shodan/host/{ioc}',
            params={'key': settings.shodan_api_key},
        )
        if r.status_code == 404:
            return {'status': 'not_found'}
        r.raise_for_status()

        d = r.json()
        services = list({
            item.get('product', '')
            for item in d.get('data', [])
            if item.get('product')
        })[:5]

        return {
            'status': 'ok',
            'ports': sorted(d.get('ports', []))[:20],
            'services': services,
            'hostnames': d.get('hostnames', [])[:5],
            'org': d.get('org', ''),
            'country': d.get('country_name', ''),
            'os': d.get('os') or '',
            'link': f'https://www.shodan.io/host/{ioc}',
        }
    except Exception as e:
        return {'status': 'error', 'detail': str(e)[:200]}


async def _threatfox(client: httpx.AsyncClient, ioc: str, _ioc_type: str) -> dict:
    try:
        r = await client.post(
            'https://threatfox-api.abuse.ch/api/v1/',
            json={'query': 'search_ioc', 'search_term': ioc},
        )
        r.raise_for_status()
        d = r.json()

        if d.get('query_status') == 'no_result':
            return {'status': 'not_found', 'verdict': 'clean'}

        hits = d.get('data') or []
        if not hits:
            return {'status': 'not_found', 'verdict': 'clean'}

        hit = hits[0]
        return {
            'status': 'ok',
            'verdict': 'malicious',
            'malware': hit.get('malware_printable', ''),
            'threat_type': hit.get('threat_type', ''),
            'confidence': hit.get('confidence_level', 0),
            'first_seen': (hit.get('first_seen') or '')[:10],
            'tags': hit.get('tags') or [],
            'link': f'https://threatfox.abuse.ch/browse.php?search=ioc%3A{ioc}',
        }
    except Exception as e:
        return {'status': 'error', 'detail': str(e)[:200]}


async def _malwarebazaar(client: httpx.AsyncClient, ioc: str, ioc_type: str) -> dict:
    if ioc_type not in ('md5', 'sha1', 'sha256'):
        return {'status': 'unsupported'}

    try:
        r = await client.post(
            'https://mb-api.abuse.ch/api/v1/',
            data={'query': 'get_info', 'hash': ioc},
        )
        r.raise_for_status()
        d = r.json()

        if d.get('query_status') != 'ok':
            return {'status': 'not_found', 'verdict': 'unknown'}

        hits = d.get('data') or []
        if not hits:
            return {'status': 'not_found', 'verdict': 'unknown'}

        hit = hits[0]
        return {
            'status': 'ok',
            'verdict': 'malicious',
            'file_name': hit.get('file_name', ''),
            'file_type': hit.get('file_type', ''),
            'file_size': hit.get('file_size', 0),
            'signature': hit.get('signature') or '',
            'tags': hit.get('tags') or [],
            'first_seen': (hit.get('first_seen') or '')[:10],
            'link': f'https://bazaar.abuse.ch/sample/{ioc}/',
        }
    except Exception as e:
        return {'status': 'error', 'detail': str(e)[:200]}


async def _proxycheck(client: httpx.AsyncClient, ioc: str, ioc_type: str) -> dict:
    if ioc_type != 'ip':
        return {'status': 'unsupported'}
    # VPN detection requires an API key — without one the vpn=1 flag returns unreliable data
    if not settings.proxycheck_api_key:
        return {'status': 'no_key'}

    try:
        r = await client.get(
            f'https://proxycheck.io/v2/{ioc}',
            params={'key': settings.proxycheck_api_key, 'vpn': '1', 'asn': '1'},
        )
        if r.status_code == 429:
            return {'status': 'error', 'detail': 'Rate limited'}
        r.raise_for_status()

        d = r.json()
        # Only trust status=ok; warning/error responses contain unreliable IP data
        if d.get('status') != 'ok':
            return {'status': 'error', 'detail': d.get('message', 'Unknown error')}

        ip_data = d.get(ioc, {})
        is_proxy = ip_data.get('proxy', 'no') == 'yes'
        proxy_type = ip_data.get('type', '')
        provider   = ip_data.get('provider', '')

        return {
            'status':     'ok',
            'verdict':    'suspicious' if is_proxy else 'clean',
            'is_proxy':   is_proxy,
            'proxy_type': proxy_type,
            'provider':   provider,
            'link':       f'https://proxycheck.io/v2/{ioc}?vpn=1&asn=1',
        }
    except Exception as e:
        return {'status': 'error', 'detail': str(e)[:200]}


async def _otx(client: httpx.AsyncClient, ioc: str, ioc_type: str) -> dict:
    if not settings.otx_api_key:
        return {'status': 'no_key'}
    if ioc_type == 'unknown':
        return {'status': 'unsupported'}

    base    = 'https://otx.alienvault.com/api/v1'
    headers = {'X-OTX-API-KEY': settings.otx_api_key}

    # Map our internal types to OTX indicator path segments
    _indicator_path = {
        'ip': 'IPv4', 'domain': 'domain',
        'md5': 'file', 'sha1': 'file', 'sha256': 'file',
        'url': 'url',
    }
    _link_path = {
        'ip': 'ip', 'domain': 'domain',
        'md5': 'file', 'sha1': 'file', 'sha256': 'file',
        'url': 'url',
    }
    ind = _indicator_path.get(ioc_type, 'domain')
    ioc_enc = quote(ioc, safe='') if ioc_type == 'url' else ioc

    try:
        # Always fetch general; fetch an extra section in parallel based on type
        if ioc_type in ('ip', 'domain'):
            extra_url = f'{base}/indicators/{ind}/{ioc_enc}/malware'
        elif ioc_type in ('md5', 'sha1', 'sha256'):
            extra_url = f'{base}/indicators/file/{ioc_enc}/analysis'
        else:
            extra_url = None

        if extra_url:
            general_r, extra_r = await asyncio.gather(
                client.get(f'{base}/indicators/{ind}/{ioc_enc}/general', headers=headers),
                client.get(extra_url, headers=headers),
                return_exceptions=True,
            )
        else:
            general_r = await client.get(f'{base}/indicators/{ind}/{ioc_enc}/general', headers=headers)
            extra_r = None

        # Handle auth / not-found on general
        if isinstance(general_r, Exception):
            return {'status': 'error', 'detail': str(general_r)[:200]}
        if general_r.status_code == 404:
            return {'status': 'not_found', 'verdict': 'unknown', 'pulse_count': 0}
        if general_r.status_code in (401, 403):
            return {'status': 'bad_key'}
        general_r.raise_for_status()
        d = general_r.json()

        # Pulse info
        pulse_info = d.get('pulse_info', {})
        count      = pulse_info.get('count', 0)
        pulses     = pulse_info.get('pulses', [])[:5]
        tags       = list({t for p in pulses for t in p.get('tags', [])})[:6]
        families   = list({m.get('display_name', '') for p in pulses for m in p.get('malware_families', []) if m.get('display_name')})[:4]

        # OTX reputation: typically 0 (neutral), negative = bad
        otx_rep = d.get('reputation', 0) or 0

        # Verdict: use pulses + OTX reputation score
        if count >= 3 or otx_rep < -1:
            verdict = 'malicious'
        elif count >= 1 or otx_rep < 0:
            verdict = 'suspicious'
        else:
            # 0 pulses doesn't mean clean — it means no community intel
            verdict = 'unknown'

        result: dict = {
            'status':           'ok',
            'verdict':          verdict,
            'pulse_count':      count,
            'malware_families': families,
            'tags':             tags,
            'link':             f'https://otx.alienvault.com/indicator/{_link_path.get(ioc_type, "domain")}/{ioc}',
        }

        # Geo / ASN data (present on IPv4 + domain general responses)
        if d.get('asn'):
            result['as_owner'] = d['asn']
        if d.get('country_name'):
            result['country'] = d['country_name']
        if d.get('city'):
            result['city'] = d['city']

        # Extra section results
        if extra_r and not isinstance(extra_r, Exception) and extra_r.status_code == 200:
            try:
                extra = extra_r.json()
                if ioc_type in ('ip', 'domain'):
                    # /malware returns a list of malware samples associated with this indicator
                    malware_data = extra.get('data', [])
                    result['malware_count'] = len(malware_data)
                    if malware_data and not families:
                        result['malware_families'] = list({
                            m.get('detections', {}).get('Avast', '')
                            or m.get('detections', {}).get('avg', '')
                            or m.get('hash', '')[:8]
                            for m in malware_data[:4]
                            if m
                        })[:4]
                elif ioc_type in ('md5', 'sha1', 'sha256'):
                    # /analysis returns full sandbox/AV data
                    analysis = extra.get('analysis', {})
                    info = analysis.get('info', {}).get('results', {})
                    if info.get('file_type') and not result.get('file_type'):
                        result['file_type'] = info['file_type']
                    if info.get('file_size'):
                        result['file_size'] = int(info['file_size'])
                    # AV detections from plugins.avast / plugins.avg etc.
                    plugins = analysis.get('plugins', {})
                    av_detections = sum(
                        1 for name, data in plugins.items()
                        if isinstance(data, dict) and data.get('results', {}).get('detection')
                    )
                    if av_detections:
                        result['av_detections'] = av_detections
            except Exception:
                pass

        return result

    except Exception as e:
        return {'status': 'error', 'detail': str(e)[:200]}


def _overall_verdict(sources: dict) -> str:
    verdicts = [v.get('verdict') for v in sources.values() if v.get('verdict')]
    if 'malicious' in verdicts:
        return 'malicious'
    if 'suspicious' in verdicts:
        return 'suspicious'
    if any(v.get('status') == 'ok' for v in sources.values()):
        return 'clean'
    return 'unknown'


async def enrich_ioc(ioc: str) -> dict:
    """Enrich a single IOC — importable by other routers (e.g. bulk_enrich)."""
    ioc = _defang(ioc.strip())
    ioc_type = _detect(ioc)

    async with httpx.AsyncClient(timeout=15) as client:
        fns = {
            'virustotal': _vt,
            'abuseipdb': _abuseipdb,
            'urlscan': _urlscan,
            'shodan': _shodan,
            'threatfox': _threatfox,
            'malwarebazaar': _malwarebazaar,
            'otx': _otx,
            'proxycheck': _proxycheck,
            'misp': _misp_enrich,
        }
        results = await asyncio.gather(
            *[fn(client, ioc, ioc_type) for fn in fns.values()],
            return_exceptions=True,
        )

    sources = {
        key: (res if not isinstance(res, Exception) else {'status': 'error', 'detail': str(res)[:200]})
        for key, res in zip(fns.keys(), results)
    }

    return {
        'ioc': ioc,
        'type': ioc_type,
        'verdict': _overall_verdict(sources),
        'sources': sources,
    }


class EnrichRequest(BaseModel):
    ioc: str


@router.post('/enrich')
async def enrich(req: EnrichRequest):
    return await enrich_ioc(req.ioc)
