"""Quick manual test for services/report_render.py — renders a sample report."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from services.report_render import render_report_html, looks_like_html, parse_front_matter

SAMPLE = """---
title: Monthly Threat Landscape — Australia
subtitle: Operational CTI report for SOC and IR teams — May 2026 reporting window
tlp: TLP:AMBER
audience: SOC analysts and IR teams
date: 12 June 2026
---

## 1. Bottom Line Up Front

- Ransomware activity against Australian healthcare rose 11% month-on-month, driven by **Qilin** affiliates [1,3].
- CVE-2026-21412 [[CRITICAL]] in FortiGate SSL-VPN is under active exploitation; ACSC issued an alert on 28 May [2].
- **What to do:** prioritise the patching order in section 3 and load the consolidated IOCs in section 5.

::: stats
1,200 | INCIDENTS REPORTED [3]
11% | MOM INCREASE [3]
4 | ACTIVELY EXPLOITED CVES [2]
:::

## 2. Australian Incidents

The OAIC confirmed a notifiable breach affecting 45,000 customers of a Victorian health insurer on 22 May [4]. *Initial access* was via a phished O365 credential with no MFA [4].

::: callout Decisions required this month
- Approve emergency patching window for FortiGate fleet [2]
- Fund MFA rollout completion for the remaining 12% of accounts [4]
:::

### 2.1 Timeline

| Date | Event | Severity |
|------|-------|----------|
| 2026-05-08 | Initial phish delivered | [[MEDIUM]] |
| 2026-05-12 | Credential replay from 203.0.113.7 | [[HIGH]] |
| 2026-05-22 | Data exfiltration confirmed | [[CRITICAL]] |

## 3. Detection Guidance

Hunt for the replay pattern with this KQL:

```kql
SigninLogs
| where IPAddress == "203.0.113.7"
| where ResultType == 0
```

Inline lookup example: `grep -r "203.0.113.7" /var/log/` finds local hits.

> Analyst note: confidence is moderate; attribution to Qilin is based on shared infrastructure only [1].

## 4. References

1. CrowdStrike — Qilin affiliate infrastructure report — 2026-05-30 — https://www.crowdstrike.com/blog/qilin-affiliates
2. ACSC — Alert AA26-148A FortiGate exploitation — 2026-05-28 — https://www.cyber.gov.au/alerts/aa26-148a
3. ACSC — Monthly cyber threat statistics — 2026-06-02 — https://www.cyber.gov.au/stats/may-2026
4. OAIC — Notifiable data breach statement — 2026-05-25 — https://www.oaic.gov.au/ndb/statements/2026-05
"""

assert not looks_like_html(SAMPLE), "sample wrongly detected as HTML"
assert looks_like_html("<!DOCTYPE html><html></html>"), "html not detected"
assert looks_like_html("```html\n<!DOCTYPE html><html></html>\n```"), "fenced html not detected"

fm, _body = parse_front_matter(SAMPLE)
assert fm["title"].startswith("Monthly Threat Landscape"), fm
assert fm["tlp"] == "TLP:AMBER", fm

out_dir = Path(__file__).parent / "reports"
out_dir.mkdir(exist_ok=True)

dark, title = render_report_html(SAMPLE, mode="dark", fallback_title="Fallback", badge="OPERATIONAL")
pdf, _ = render_report_html(SAMPLE, mode="pdf", fallback_title="Fallback", badge="OPERATIONAL")

(out_dir / "_test-render-dark.html").write_text(dark, encoding="utf-8")
(out_dir / "_test-render-pdf.html").write_text(pdf, encoding="utf-8")

# Structural assertions
checks = {
    "title in <title>": "<title>Monthly Threat Landscape — Australia</title>" in dark,
    "citation anchor": '<sup class="cite">[<a href="#ref-1">1</a>' in dark,
    "grouped citation": '<a href="#ref-1">1</a>,<a href="#ref-3">3</a>' in dark,
    "ref id wired": '<li id="ref-2">' in dark,
    "ref url linked": 'href="https://www.cyber.gov.au/alerts/aa26-148a"' in dark,
    "stats block": '<div class="stats">' in dark and ">1,200<" in dark,
    "callout block": '<div class="callout">' in dark and "Decisions required" in dark,
    "severity pill": '<span class="pill sev-crit">CRITICAL</span>' in dark,
    "table rendered": "<table><thead>" in dark and "<td>2026-05-22</td>" in dark,
    "kql code block": 'class="lang-kql"' in dark and "SigninLogs" in dark,
    "inline code kept": "<code>grep -r" in dark,
    "bold rendered": "<strong>Qilin</strong>" in dark,
    "blockquote": "<blockquote>" in dark,
    "present button": 'id="presentBtn"' in dark,
    "present js": "togglePresent" in dark,
    "no raw [[": "[[" not in dark,
    "pdf tlp pill": 'class="tlp-pill">TLP:AMBER</span>' in pdf,
    "pdf no script": "<script>" not in pdf,
    "pdf a4": "size:A4" in pdf,
    "ip not cited": "[3]" not in dark.split("references")[0].replace('<sup class="cite">', "KEEP"),
}

failed = [k for k, ok in checks.items() if not ok]
for k, ok in checks.items():
    print(("PASS " if ok else "FAIL ") + k)
if failed:
    sys.exit(f"\n{len(failed)} check(s) failed: {failed}")
print(f"\nOK — dark: {len(dark):,} chars, pdf: {len(pdf):,} chars")
print(f"Returned title: {title}")
