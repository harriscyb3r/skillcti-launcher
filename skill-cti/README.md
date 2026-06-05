# SkillCTI

An AI-powered Cyber Threat Intelligence platform. Generate professional analyst reports, search IOCs, enumerate domains, track CVEs, and monitor threat actor activity — all from a single local web application backed by Claude.

![SkillCTI Dashboard](https://img.shields.io/badge/status-active-brightgreen) ![Python](https://img.shields.io/badge/python-3.11%2B-blue) ![React](https://img.shields.io/badge/react-18-61dafb) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

| Feature | Description |
|---|---|
| **Skills** | AI-powered report generation — tabletop exercises, threat actor profiles, CVE briefs, monthly CTI reports, domain enumeration reports, and more |
| **Background Jobs** | Reports generate server-side — close your laptop, let your screen sleep, the job keeps running and appears in the Jobs panel when done |
| **IOC Search** | Enrich IPs, domains, hashes, and URLs across VirusTotal, AbuseIPDB, urlscan.io, Shodan, and ThreatFox in one query |
| **CVE Search** | Search and analyse CVEs with AI-generated impact briefs |
| **Domain Enumeration** | DNS, WHOIS, subdomains, and open-port recon against a target domain |
| **Watchlist** | Monitor a list of threat actors and get alerts when new intelligence surfaces |
| **Regional Threat Pulse** | Weekly dashboard snapshot of threat actors, incidents, and CVEs relevant to your geography |
| **Analyst** | General-purpose AI chat with CTI context |
| **Reports** | Browse, view, and download all previously generated HTML, PDF, and PPTX reports |
| **Multi-model** | Choose between Haiku (fast), Sonnet (balanced), or Opus (strongest) per generation |
| **Themes** | 7 built-in colour themes — Dark, Light, Terminal, Slate, Mocha, Midnight, Cyberpunk |
| **Premium UI** | Vercel/Linear-style dark interface — shadow depth system, enforced type scale, consistent spacing tokens, purple restricted to CTA and active-state roles only |

---

## Architecture

```
skill-cti/
├── app/                  # React 18 + Vite 6 + TypeScript + Tailwind frontend
│   └── src/
│       ├── components/   # Sidebar, LaunchDrawer, StatusDot …
│       ├── pages/        # Dashboard, Skills, Reports, IOCSearch, CVESearch …
│       └── lib/          # api.ts, skills.ts, theme.ts, types.ts, generate.ts
├── backend/              # FastAPI backend (port 8765)
│   ├── routers/          # One file per feature area
│   ├── services/         # pdf_export.py, pptx_export.py, style_rule.py
│   ├── config.py         # Pydantic settings (reads .env)
│   ├── main.py           # App entry, router registration, startup hooks
│   └── requirements.txt
├── reports/              # Generated HTML / PDF / PPTX (gitignored, auto-created)
├── cti-*/                # Skill prompt directories (SKILL.md per skill)
└── .env.example          # Environment variable template
```

The frontend dev server proxies `/api`, `/v1`, `/reports`, and `/skill` to the backend at `http://localhost:8765`, so there is no CORS complexity in development.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone

```bash
git clone https://github.com/<your-repo>/skills.git
cd skills/skill-cti
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
| `VIRUSTOTAL_API_KEY` | No | IOC enrichment — file hashes, URLs, IPs |
| `ABUSEIPDB_API_KEY` | No | IOC enrichment — IP reputation |
| `URLSCAN_API_KEY` | No | IOC enrichment — URL and domain analysis |
| `SHODAN_API_KEY` | No | IOC enrichment — port/banner data for IPs |
| `THREATFOX_API_KEY` | No | IOC enrichment — Abuse.ch ThreatFox database |
| `DEFAULT_TLP` | No | Default TLP label on reports (default: `TLP:AMBER`) |
| `GEOGRAPHY` | No | Your region for the Regional Threat Pulse (e.g. `Australia`, `APAC`, `United Kingdom`) |

API keys can also be set or updated at runtime via the **Settings** page in the UI.

---

## Skills

Skills are prompt templates that drive report generation. Each skill lives in its own directory under the repo root (e.g. `cti-tabletop/SKILL.md`) and is registered in `app/src/lib/skills.ts`.

### Built-in Skills

| Skill | Output | Description |
|---|---|---|
| **Tabletop Exercise (TTX)** | HTML / PDF / PPTX | Full 6-phase incident response tabletop for a named threat actor, with injects, decision points, facilitator notes, and AU regulatory triggers |
| **Threat Actor Profile** | HTML / PDF / PPTX | Deep-dive intelligence profile on a named threat actor — TTPs, campaigns, infrastructure, victimology |
| **CTI Monthly Report (AU)** | HTML / PDF | Australian operational threat intelligence monthly summary |
| **CTI Monthly Report (Global)** | HTML / PDF | Global operational threat intelligence monthly summary |
| **CVE Brief** | HTML / PDF | Structured impact brief for a named CVE |
| **Domain Enumeration Report** | HTML / PDF | Passive and active recon report for a target domain |
| **Mythos-Ready Assessment** | HTML | Strategic readiness assessment for Claude Mythos adoption |

### Output Formats

- **HTML** — dark editorial report, saved to the Reports page, viewable in-browser with a **PRESENT** mode for projector delivery
- **PDF** — A4 print-ready brief, auto-downloaded on completion
- **PPTX** — Professional PowerPoint deck with visual slide types (stats, callouts, highlights, timelines, agendas, two-column layouts), auto-downloaded on completion

### Adding a New Skill

1. Create a directory `cti-yourskill/` containing a `SKILL.md` that describes the skill's content requirements and HTML/output structure
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
