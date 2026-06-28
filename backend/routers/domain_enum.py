"""
Domain enumeration — DNS records, WHOIS, geolocation, ISP.
"""
import asyncio
import ipaddress
import socket
from datetime import datetime
from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from config import settings

try:
    import dns.resolver
    import dns.exception
    HAS_DNS = True
except ImportError:
    HAS_DNS = False

try:
    import whois as _whois_lib
    HAS_WHOIS = True
except ImportError:
    HAS_WHOIS = False

router = APIRouter()

_IPINFO_API = "https://ipinfo.io"
_IPAPI_API  = "http://ip-api.com/json"
_IPAPI_FIELDS = "status,country,countryCode,regionName,city,isp,org,as,lat,lon,timezone"


class DomainRequest(BaseModel):
    domain: str


_BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),   # link-local / cloud metadata
    ipaddress.ip_network("100.64.0.0/10"),    # shared address space
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def _is_private_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return any(addr in net for net in _BLOCKED_NETWORKS)
    except ValueError:
        return False


def _clean_domain(raw: str) -> str:
    d = raw.strip().lower()
    for proto in ("https://", "http://"):
        if d.startswith(proto):
            d = d[len(proto):]
    d = d.split("/")[0].split(":")[0].split("?")[0]
    return d


async def _resolve_ips(domain: str) -> list[str]:
    if HAS_DNS:
        try:
            answers = dns.resolver.resolve(domain, "A", lifetime=8)
            return list({str(r) for r in answers})
        except Exception:
            pass
    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, socket.getaddrinfo, domain, None)
        return list({i[4][0] for i in info if ":" not in i[4][0]})
    except Exception:
        return []


async def _get_dns_records(domain: str) -> list[dict[str, Any]]:
    if not HAS_DNS:
        return []
    records: list[dict[str, Any]] = []
    for rtype in ("A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"):
        try:
            answers = dns.resolver.resolve(domain, rtype, lifetime=8)
            ttl = answers.rrset.ttl if answers.rrset else None
            for r in answers:
                entry: dict[str, Any] = {"type": rtype, "ttl": ttl}
                if rtype == "MX":
                    entry["value"] = str(r.exchange).rstrip(".")
                    entry["priority"] = int(r.preference)
                elif rtype in ("NS", "CNAME"):
                    entry["value"] = str(r.target).rstrip(".")
                elif rtype == "TXT":
                    entry["value"] = " ".join(
                        p.decode("utf-8", errors="replace") if isinstance(p, bytes) else str(p)
                        for p in r.strings
                    )
                elif rtype == "SOA":
                    entry["value"] = (
                        f"mname={str(r.mname).rstrip('.')} rname={str(r.rname).rstrip('.')}"
                        f" serial={r.serial} refresh={r.refresh} retry={r.retry}"
                        f" expire={r.expire} minimum={r.minimum}"
                    )
                else:
                    entry["value"] = str(r)
                records.append(entry)
        except (dns.exception.DNSException, Exception):
            pass
    return records


def _coerce(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, (list, tuple, set, frozenset)):
        out: list[Any] = []
        for x in v:
            c = _coerce(x)
            if c is not None and c not in out:
                out.append(c)
        return out[:8]
    return str(v)


async def _get_whois(domain: str) -> dict[str, Any] | None:
    if not HAS_WHOIS:
        return None
    try:
        loop = asyncio.get_event_loop()
        w = await asyncio.wait_for(
            loop.run_in_executor(None, _whois_lib.whois, domain),
            timeout=12,
        )
        if w is None:
            return None

        def _first(v: Any) -> Any:
            if isinstance(v, (list, tuple, set, frozenset)):
                items = list(v)
                return _coerce(items[0]) if items else None
            return _coerce(v)

        nameservers = w.name_servers
        if isinstance(nameservers, (set, list, tuple)):
            nameservers = sorted({str(n).lower().rstrip(".") for n in nameservers if n})
        elif nameservers:
            nameservers = [str(nameservers).lower().rstrip(".")]
        else:
            nameservers = []

        status = w.status
        if isinstance(status, (list, set, tuple)):
            status = [s.split()[0] for s in status if s]
        elif status:
            status = [str(status).split()[0]]
        else:
            status = []

        return {
            "registrar": _first(w.registrar),
            "created": _first(w.creation_date),
            "expires": _first(w.expiration_date),
            "updated": _first(w.updated_date),
            "status": status[:6],
            "nameservers": nameservers[:8],
            "org": _first(w.org),
            "country": _first(w.country),
            "emails": _coerce(w.emails)[:5] if w.emails else [],
            "dnssec": _first(getattr(w, "dnssec", None)),
        }
    except asyncio.TimeoutError:
        return {"error": "WHOIS lookup timed out"}
    except Exception as e:
        return {"error": str(e)}


async def _geolocate(client: httpx.AsyncClient, ip: str) -> dict[str, Any]:
    # Primary: ipinfo.io — authoritative ASN/org data via RDAP, works without a key
    try:
        params: dict[str, str] = {"token": settings.ipinfo_api_token} if settings.ipinfo_api_token else {}
        r = await client.get(
            f"{_IPINFO_API}/{ip}/json",
            params=params,
            headers={"Accept": "application/json"},
        )
        if r.status_code == 200:
            d = r.json()
            if "bogon" not in d:
                # org field is "AS#### Org Name" — split into AS number and name
                org_raw = d.get("org", "")
                parts = org_raw.split(" ", 1)
                as_num = parts[0] if parts else ""
                org_name = parts[1] if len(parts) > 1 else org_raw
                loc_parts = (d.get("loc") or "").split(",")
                lat = float(loc_parts[0]) if len(loc_parts) > 0 and loc_parts[0] else None
                lon = float(loc_parts[1]) if len(loc_parts) > 1 and loc_parts[1] else None
                return {
                    "ip": ip,
                    "country": d.get("country"),
                    "country_code": d.get("country"),
                    "region": d.get("region"),
                    "city": d.get("city"),
                    "isp": org_name or org_raw,
                    "org": org_name or org_raw,
                    "as_info": as_num,
                    "lat": lat,
                    "lon": lon,
                    "timezone": d.get("timezone"),
                    "hostname": d.get("hostname"),
                    "source": "ipinfo.io",
                }
    except Exception:
        pass

    # Fallback: ip-api.com (free, rate-limited)
    try:
        r = await client.get(f"{_IPAPI_API}/{ip}", params={"fields": _IPAPI_FIELDS})
        if r.status_code == 200:
            d = r.json()
            if d.get("status") == "success":
                return {
                    "ip": ip,
                    "country": d.get("country"),
                    "country_code": d.get("countryCode"),
                    "region": d.get("regionName"),
                    "city": d.get("city"),
                    "isp": d.get("isp"),
                    "org": d.get("org"),
                    "as_info": d.get("as"),
                    "lat": d.get("lat"),
                    "lon": d.get("lon"),
                    "timezone": d.get("timezone"),
                    "source": "ip-api.com",
                }
    except Exception:
        pass

    return {"ip": ip}


async def _get_subdomains(client: httpx.AsyncClient, domain: str) -> tuple[list[str], int]:
    """Query crt.sh certificate transparency logs for subdomain enumeration."""
    try:
        # Build URL manually — httpx would percent-encode % to %25 if passed via params
        url = f"https://crt.sh/?q=%.{domain}&output=json"
        r = await client.get(
            url,
            timeout=httpx.Timeout(25.0),
            headers={"User-Agent": "SkillCTI/2.0", "Accept": "application/json"},
        )
        if r.status_code != 200:
            print(f"  crt.sh returned {r.status_code} for {domain}")
            return [], 0

        certs = r.json()
        cert_count = len(certs)
        suffix = f".{domain}"
        seen: set[str] = set()

        for cert in certs:
            for raw in cert.get("name_value", "").split("\n"):
                name = raw.strip().lower()
                if name.startswith("*."):
                    name = name[2:]  # strip wildcard prefix, keep the subdomain
                if name.endswith(suffix) and name != domain and name not in seen:
                    seen.add(name)

        print(f"  crt.sh: {cert_count} certs, {len(seen)} unique subdomains for {domain}")
        return sorted(seen), cert_count

    except Exception as e:
        print(f"  crt.sh lookup failed for {domain}: {e}")
        return [], 0


@router.post("/domain-enum")
async def domain_enum(req: DomainRequest):
    domain = _clean_domain(req.domain)
    if not domain or "." not in domain:
        return {
            "domain": domain, "error": "Invalid domain",
            "resolved_ips": [], "dns_records": [], "whois": None, "geo": [],
            "subdomains": [], "subdomain_cert_count": 0,
        }

    # Resolve IPs first and reject private/internal addresses
    initial_ips = await _resolve_ips(domain)
    if any(_is_private_ip(ip) for ip in initial_ips):
        return {
            "domain": domain,
            "error": "Domain resolves to a private or reserved IP address — enumeration blocked.",
            "resolved_ips": [], "dns_records": [], "whois": None, "geo": [],
            "subdomains": [], "subdomain_cert_count": 0,
        }

    async with httpx.AsyncClient(timeout=20) as client:
        dns_records, whois_data, sub_result = await asyncio.gather(
            _get_dns_records(domain),
            _get_whois(domain),
            _get_subdomains(client, domain),
        )
        ips = initial_ips
        subdomains, cert_count = sub_result
        geo_results = await asyncio.gather(*[_geolocate(client, ip) for ip in ips[:4]])

    return {
        "domain": domain,
        "resolved_ips": ips,
        "dns_records": dns_records,
        "whois": whois_data,
        "geo": list(geo_results),
        "subdomains": subdomains,
        "subdomain_cert_count": cert_count,
    }
