# SkillCTI

An AI-powered Cyber Threat Intelligence platform. Generate professional analyst reports, search IOCs, enumerate domains, track CVEs, manage cases, and monitor threat actor activity — all from a single local web application backed by Claude.

![SkillCTI Dashboard](https://img.shields.io/badge/status-active-brightgreen) ![Python](https://img.shields.io/badge/python-3.11%2B-blue) ![React](https://img.shields.io/badge/react-18-61dafb) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

| Feature | Description |
|---|---|
| **Dashboard** | Home page with stat counters (reports generated, this week, total API spend, backend status), 8-week report activity bar chart, report-types donut, active watchlist alerts, quick-launch skill tiles, recent reports list, recent news feed, skill usage chart, Regional Threat Pulse, and Threat Actor of the Week spotlight |
| **Regional Threat Pulse** | AI-generated, geography-scoped snapshot of active threat actors, recent incidents, and relevant CVEs — includes a CVE risk profile bar by severity. Requires a region to be set in Settings; refreshable on demand |
| **Threat Actor of the Week** | AI-generated single-actor spotlight showing aliases, origin, motivation, targets, signature techniques, notable tools, and recent activity — refreshable on demand |
| **Skills** | AI-powered report generation across CTI reports, on-demand analysis, DFIR, strategy, and TPRM — see Skills section below |
| **Background Jobs** | Reports generate server-side — close your laptop, let your screen sleep, the job keeps running and appears in the Jobs panel when done |
| **Scheduled Reports** | Schedule recurring report generation on cron-style intervals — daily briefs, weekly summaries, monthly reports |
| **IOC Search** | Enrich IPs, domains, hashes, and URLs across VirusTotal, AbuseIPDB, OTX, urlscan.io, Shodan, ThreatFox, MISP, and Hybrid Analysis in one query — with AI-generated triage summary |
| **Bulk IOC Enrich** | Upload or paste a list of IOCs for batch enrichment with consolidated verdict table |
| **Malware Intel** | Deep hash analysis via VirusTotal, MalwareBazaar, and Hybrid Analysis — detections, C2 relationships, YARA hits, sandbox verdicts |
| **CVE Search** | Search and analyse CVEs with AI-generated impact briefs |
| **Domain Enumeration** | DNS, WHOIS, subdomains, and open-port recon against a target domain |
| **Credential Exposure** | Identity and credential monitoring — combines HIBP, HudsonRock Cavalier (infostealer logs), LeakIX, and IntelX. Accepts domain or email address |
| **Ransomware Tracker** | Live ransomware victim feed from ransomware.live — filterable by group, sector, and date |
| **Threat Actors** | Curated ransomware actor profiles with MITRE ATT&CK TTP mapping |
| **MITRE ATT&CK** | Offline ATT&CK matrix browser — tactics, techniques, sub-techniques, threat groups, and technique detail. STIX bundle downloaded on startup |
| **MISP** | Browse events from your local MISP instance, search by keyword, click through IOCs to IOC Lookup, and automatically inject MISP context into all AI-generated reports and Analyst chat |
| **Cases** | Full case management system — create and track investigations with notes, artifacts (IOCs, hashes, files), status and priority, TLP labels, and tags |
| **Clients** | Engagement manager — store client profiles with industry, threat context, key assets, and contact details. Client context can be injected into report generation |
| **PIR** | Priority Intelligence Requirements — define standing collection questions, track findings, and monitor rescan schedules |
| **Library** | Intelligence library for saving and tagging notes, IOCs, reports, and finished intelligence items for future reference |
| **Watchlist** | Monitor a list of threat actors and get alerts when new intelligence surfaces; unread alerts surface on the Dashboard |
| **News Feed** | Aggregated cyber security news from government, media, and research sources with unread tracking; preview of latest articles appears on the Dashboard |
| **Feeds** | Curated threat intelligence feeds — OTX pulses, Abuse.ch (ThreatFox, MalwareBazaar, URLhaus) |
| **Analyst** | General-purpose AI chat with CTI context — enriched with live MISP events when connected |
| **Reports** | Browse, view, and download all previously generated HTML, PDF, and PPTX reports |
| **Multi-model** | Choose between Haiku (fast), Sonnet (balanced), or Opus (strongest) per generation |
| **Themes** | 7 built-in colour themes — Dark, Light, Terminal, Slate, Mocha, Midnight, Cyberpunk |
| **Premium UI** | Vercel/Linear-style dark interface — shadow depth system, enforced type scale, consistent spacing tokens, purple restricted to CTA and active-state roles only |

---

## Architecture

```
skill-cti/                # Repo root
├── app/                  # React 18 + Vite 6 + TypeScript + Tailwind frontend
│   └── src/
│       ├── components/   # Sidebar, LaunchDrawer, StatusDot …
│       ├── pages/        # Dashboard, Skills, Reports, IOCSearch, CVESearch …
│       └── lib/          # api.ts, skills.ts, theme.ts, types.ts, generate.ts
├── backend/              # FastAPI backend (port 8765)
│   ├── routers/          # One file per feature area
│   ├── services/         # pdf_export.py, pptx_export.py, style_rule.py
│   ├── data/             # Seed data (ransomware_actors.json); runtime DBs are gitignored
│   ├── config.py         # Pydantic settings (reads .env)
│   ├── main.py           # App entry, router registration, startup hooks
│   ├── requirements.txt
│   ├── .env.example      # Environment variable template — copy to .env and fill in
│   └── .env              # Your local secrets — gitignored, never committed
├── reports/              # Generated HTML / PDF / PPTX — gitignored, auto-created
├── skills.js             # Skill catalogue (prompt overrides, input schemas, metadata)
└── skill-cti.html        # Standalone single-file launcher (no backend required)
```

> **Skill prompt files:** The backend looks for skill prompt files in a `skills/` directory one level above this repo (`../skills/`). Clone or symlink your skill prompts there, or update `skills_root` in `backend/config.py` to point to wherever your `SKILL.md` files live.

The frontend dev server proxies `/api`, `/v1`, `/reports`, and `/skill` to the backend at `http://localhost:8765`, so there is no CORS complexity in development.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone

```bash
git clone https://github.com/harriscyb3r/skill-cti.git
cd skill-cti
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY (required) and any optional enrichment keys
pip install -r requirements.txt
python main.py
# Backend now running on http://localhost:8765
```

### 3. Frontend

```bash
cd app
npm install
npm run dev
# Open http://localhost:5173
```

That's it. Open the app, go to **Settings**, and your API keys are already loaded from `.env`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values.

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | Claude API key from [console.anthropic.com](https://console.anthropic.com/) |
| `VIRUSTOTAL_API_KEY` | No | IOC enrichment — file hashes, URLs, IPs, malware intel |
| `ABUSEIPDB_API_KEY` | No | IOC enrichment — IP reputation |
| `URLSCAN_API_KEY` | No | IOC enrichment — URL and domain analysis |
| `SHODAN_API_KEY` | No | IOC enrichment — port/banner data for IPs |
| `THREATFOX_API_KEY` | No | IOC enrichment — Abuse.ch ThreatFox database |
| `HYBRID_ANALYSIS_API_KEY` | No | IOC enrichment and malware intel — sandbox reports |
| `HIBP_API_KEY` | No | Credential exposure — domain breach counts (paid HIBP API) |
| `INTELX_API_KEY` | No | Credential exposure — dark web search via IntelX |
| `OTX_API_KEY` | No | Threat feeds — AlienVault OTX pulses |
| `IPINFO_API_TOKEN` | No | IOC enrichment — IP geolocation and ASN data |
| `PROXYCHECK_API_KEY` | No | IOC enrichment — VPN/proxy/anonymizer detection |
| `MISP_URL` | No | Base URL of your MISP instance (e.g. `https://localhost`) |
| `MISP_API_KEY` | No | MISP automation key — enables event browsing, IOC enrichment, and report context injection |
| `DEFAULT_TLP` | No | Default TLP label on reports (default: `TLP:AMBER`) |
| `GEOGRAPHY` | No | Your region for the Regional Threat Pulse (e.g. `Australia`, `APAC`, `United Kingdom`) |

API keys can also be set or updated at runtime via the **Settings** page in the UI.

---

## MISP Integration

MISP (Malware Information Sharing Platform) is an open-source threat intelligence platform. When connected, SkillCTI:

- Displays your MISP events in the **MISP** page with search and drill-down
- Enriches IOC lookups with matching MISP attributes and event context
- Injects relevant MISP intelligence into all AI-generated reports and Analyst chat

### Installing MISP with Docker

The easiest way to run a local MISP instance is with the official Docker Compose setup.

**Prerequisites:** Docker Desktop (Windows/Mac) or Docker Engine + Docker Compose (Linux)

```bash
# 1. Clone the official MISP Docker repository
git clone https://github.com/MISP/misp-docker.git
cd misp-docker

# 2. Copy the example environment file
cp template.env .env

# 3. Edit .env — set MISP_BASEURL to match where you'll access it
#    For local use:
#    MISP_BASEURL=https://localhost
#    Change MYSQL_PASSWORD and MISP_ADMIN_PASSPHRASE to something secure

# 4. Start MISP
docker compose up -d

# 5. Wait ~2-3 minutes for first-run initialisation, then open:
#    https://localhost
#    Default admin email: admin@admin.test
#    Default admin password: set in .env (MISP_ADMIN_PASSPHRASE)
```

> **Note:** MISP uses a self-signed certificate by default. Your browser will warn you — accept the exception. SkillCTI's backend skips TLS verification for MISP connections automatically (`verify=False`).

**Checking status:**

```bash
docker compose ps          # All containers should show "running"
docker compose logs -f     # Follow startup logs
```

**Stopping and starting:**

```bash
docker compose stop        # Stop containers (data preserved)
docker compose start       # Restart
docker compose down        # Stop and remove containers (data preserved in volumes)
docker compose down -v     # ⚠️ Removes all data including events
```

### Creating a MISP API Key

1. Log in to your MISP instance at `https://localhost`
2. Click your username in the top-right corner → **My Profile**
3. Scroll down to the **Auth keys** section
4. Click **Add authentication key**
5. Set an optional comment (e.g. `SkillCTI`) and expiry, then click **Submit**
6. **Copy the generated key immediately** — it is only shown once

### Connecting MISP to SkillCTI

**Option A — via `.env` (recommended for persistent setup):**

```env
MISP_URL=https://localhost
MISP_API_KEY=your_automation_key_here
```

Restart the backend after editing `.env`.

**Option B — via the Settings page:**

1. Open SkillCTI → **Settings**
2. Paste your MISP URL (e.g. `https://localhost`) and API key into the MISP fields
3. Click **Save** — the connection is tested immediately and the status dot in the sidebar updates

The sidebar shows a green MISP indicator when the connection is healthy.

---

## Skills

Skills are prompt templates that drive report generation. Each skill lives in its own directory under the repo root (e.g. `cti-tabletop/SKILL.md`) and is registered in `app/src/lib/skills.ts`.

### CTI Reports

| Skill | Description |
|---|---|
| **Daily Brief (Global)** | One-page global cyber news brief covering the last 24 hours — TLDR bullets, top stories, CVE watch, ransomware watch |
| **Operational CTI** | Dense monthly brief for SOC/IR/vuln management — CVE deep-dives, IOC table, DRAFT Sigma/KQL detection stubs. AU or Global mode |
| **Tactical CTI** | Mid-depth monthly for practitioners — BLUF, incidents with TTP analysis, priority CVEs, hunt hypotheses. AU or Global mode |
| **Strategic CTI** | Plain-English board brief — exec summary, monthly themes, top vulnerabilities in business terms, regulatory posture. AU or Global mode |
| **Sector Report** | Multi-month sector intelligence — threat actor landscape, incidents, TTP trends, supply-chain risks, regulatory posture. AU or Global mode |

### On-Demand CTI

| Skill | Description |
|---|---|
| **Security Advisory** | Client-deliverable executive advisory on any cyber event, CVE, or breach |
| **Threat Actor Profile** | Structured actor profile using the Diamond Model — TTPs, campaigns, infrastructure, victimology, IOCs |
| **Detection as Code** | Sigma rules + Sentinel/Defender KQL from a threat report or TTP list — all rules marked DRAFT |
| **YARA Rule Generator** | DRAFT YARA rules from malware analysis, vendor reports, or sample writeups |
| **ATT&CK Navigator Layer** | Extracts MITRE techniques from a report and renders inline ATT&CK matrix + Navigator JSON layer export |
| **Admiralty Assessment** | Quality-assesses a CTI report using the NATO Admiralty Code (6×6 source/information grading) |
| **STIX Bundle Export** | Parses a threat intel source, extracts IOCs, and emits a valid STIX 2.1 bundle for MISP/OpenCTI/Sentinel TI |

### DFIR

| Skill | Description |
|---|---|
| **Phishing DFIR** | Full forensic analysis of a phishing email — headers, infrastructure, URL chains, attachment lookups, campaign attribution |
| **Incident Timeline** | Consolidates raw events into a chronological UTC + local time incident timeline with phase classification |
| **IR Playbook Generator** | NIST 800-61r3 operator playbooks for 13 attack types — phase-by-phase checklists, decision trees, escalation paths, comms templates |
| **Log Analysis (Sherlog Holmes)** | Interactive SIEM-style log dashboard for triage — file upload, severity filters, IP correlation, AI summarisation |

### Strategy

| Skill | Description |
|---|---|
| **Threat Model** | PASTA or STRIDE threat model — inline SVG DFD, ATT&CK/CWE/CAPEC mappings, threat register with heatmap, NIST CSF 2.0 mitigations |
| **Tabletop Exercise (TTX)** | Facilitator-ready IR tabletop — 6 phased injects, facilitator notes, discussion questions, AU regulatory triggers |
| **BAS / Red Team Plan** | Breach and attack simulation campaign plan — 6–8 attack playbooks, atomic test cases, control-layer effectiveness matrix, MITRE coverage heatmap |
| **Mythos-Ready Assessment** | Strategic readiness assessment for AI/agent deployment — risk register, priority actions, 90-day board template |

### TPRM

| Skill | Description |
|---|---|
| **Vendor Risk Intelligence** | Third-party risk report for a vendor list — CVEs, CISA KEV hits, breach history, enforcement actions, media signals, 2×2 risk matrix |

### Output Formats

- **HTML** — dark editorial report, saved to the Reports page, viewable in-browser with a **PRESENT** mode for projector delivery
- **PDF** — A4 print-ready brief, auto-downloaded on completion
- **PPTX** — Professional PowerPoint deck with visual slide types (stats, callouts, highlights, timelines, agendas, two-column layouts), auto-downloaded on completion

### Adding a New Skill

1. Create a directory `skills/cti-yourskill/` (in the repo root `skills/` folder) containing a `SKILL.md` that describes the skill's content requirements and HTML/output structure
2. Register it in `app/src/lib/skills.ts` following the existing pattern
3. Restart the frontend dev server — the skill appears in the Skills gallery immediately

---

## Background Job System

All report generation runs **server-side** as an asyncio background task. The browser is only used to submit the job and poll for status — closing the tab, sleeping the laptop, or losing the network connection does not interrupt generation.

- Jobs persist to disk (`reports/_job-{id}.json`) and survive a backend restart
- The **Jobs** panel shows live progress with a character count and estimated completion
- Completed jobs link directly to the report viewer (HTML) or trigger a download (PDF/PPTX)
- The sidebar shows an animated badge with the count of active jobs

---

## Report Viewer

HTML reports render in a full-screen panel with:
- A sticky sidebar table-of-contents with scroll-spy
- Citation superscripts `[n]` linked to a references section
- A **PRESENT** button (top-right) that enters a projector-optimised fullscreen view with larger type

---

## UI Design System

The frontend enforces a set of conventions across all pages and components. Follow these when adding new views.

### Typography

| Role | Size / Weight | Font |
|---|---|---|
| Page title | 22px / 700 | Inter (`font-sans`) |
| Card heading | 14–15px / 600 | Inter |
| Body text | 13px / 400 | Inter |
| Section labels | 11px / 500, `uppercase tracking-[0.2em]`, `text-txt-3` | Inter |
| Data identifiers | 10px / 700 | IBM Plex Mono (`font-mono`) |

`font-mono` is **only** for data values: IOC values, CVE IDs, hashes, ATT&CK IDs, CVSS vectors, TLP badges, timestamps, and code blocks. All UI chrome uses `font-sans`.

**Size floor:** never go below 11px for UI text or 10px for `font-mono` data values. For small labels and badges, compensate with weight and `tracking-*` instead of shrinking. Inter's optical features (`cv11`, `ss01`, `ss03`), `-0.011em` letter-spacing, and `tabular-nums` are applied globally in `index.css`.

### Colours

Tailwind CSS variable-based theming via CSS custom properties. Key tokens: `bg`, `surface`, `surface2`, `border`, `border2`, `txt`, `txt-2`, `txt-3`, `purple`, `cyan`, `green`, `red`, `amber`.

**Purple is restricted to two roles only:**
1. CTA / primary actions — gradient buttons, focus rings, toggle active, loading spinners
2. Active / selected state — `border-l-purple`, `bg-purple/[0.08]`, active nav items, unread badges

Do not use purple for hover effects, decorative tags, icon tints, or data badges.

### Shadows

| Token | Usage |
|---|---|
| `shadow-card` | Every `bg-surface` card — adds depth + inset top highlight (dark) or soft drop shadow (light) |
| `shadow-elevated` | Drawers, panels, and overlays that float above the base surface |

### Border radius

- `rounded-lg` (8px) — cards and panels
- `rounded-md` (6px) — inputs and secondary controls
- `rounded-sm` (4px) — badges and pills

### Spacing

Four tokens cover all spacing needs:

| Token | Size | Use |
|---|---|---|
| `p-3` / `gap-3` / `mb-3` | 12px | Tight inline groups (icon+label, section label → content) |
| `p-4` / `gap-4` / `mb-4` | 16px | Card internal padding, between related items |
| `p-6` / `gap-6` / `mb-6` | 24px | Page outer padding, between major sections |
| `p-8` / `gap-8` / `mb-8` | 32px | Sparse hero areas |

Avoid arbitrary values (`p-[26px]`, `mb-[14px]`, etc.).

---

## Development

### Frontend build

```bash
cd app
npm run build   # Outputs to app/dist/
```

The backend serves `app/dist/` as static files in production (`/`), so a single `python main.py` runs the whole stack.

### Backend

The FastAPI backend auto-reloads in development if you run:

```bash
cd backend
uvicorn main:app --reload --port 8765
```

### Proxy config

`app/vite.config.ts` proxies these paths to `http://localhost:8765`:
- `/api` — backend API
- `/v1` — Anthropic proxy endpoint
- `/reports` — report file serving
- `/skill` — skill prompt file serving
- `/generate-pdf`, `/generate-pptx` — export endpoints

---

## Security Notes

- The backend exposes your Anthropic API key through its proxy — **do not expose port 8765 to the internet**. Run locally or behind authentication if deployed.
- Generated reports may contain sensitive intelligence. The `reports/` directory is gitignored; treat its contents as TLP:AMBER or higher by default.
- All enrichment API keys are stored in `backend/.env` which is gitignored. Never commit this file.

---

## Contributing

Pull requests welcome. Please open an issue first for significant changes.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-skill`)
3. Commit your changes
4. Push and open a PR

---

## License

MIT — see [LICENSE](LICENSE) for details.
