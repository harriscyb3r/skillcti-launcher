# Screenshots

This directory holds visual assets referenced from the project README.

## What to capture

| File | What it should show | Notes |
| --- | --- | --- |
| `launcher.png` | The SkillCTI launcher Home tab with the 2×2 widget grid (Recent Reports, Daily Cyber News, AU Ransomware Victims, Quick Ask Analyst) | Hero image — first thing GitHub visitors see |
| `cti-analyst.png` *(optional)* | The CTI Analyst chat mid-conversation with a `LAUNCH →` skill card visible | Shows the conversational discovery layer |
| `report-sample.png` *(optional)* | A rendered HTML report in the modal viewer (e.g. tactical AU monthly) with citations and the Present button visible | Demonstrates output quality |
| `pdf-export.png` *(optional)* | The light-theme print preview of a report | Shows the PDF pipeline |

## Capture checklist (for `launcher.png`)

1. Start the proxy: `cd skill-cti && python proxy.py`
2. Open `skill-cti/skill-cti.html` in Edge or Chrome at **1440 × 900** window size (or larger 16:9)
3. Use the Home tab (default landing)
4. Wait for all four widgets to populate (Daily Cyber News may take ~5–10s on first load)
5. Capture the full browser window — not the desktop. On Windows: `Win + Shift + S` → "Window snip"
6. Save as `launcher.png` in this directory (PNG, lossless)
7. Aim for ≤ 1 MB file size; if larger, run through [tinypng.com](https://tinypng.com) before committing

## Image guidelines

- **Format**: PNG for screenshots, GIF only if showing a workflow (≤ 5 MB)
- **Dimensions**: 1440–1920 px wide; GitHub will render responsively
- **Annotations**: avoid — let the UI speak; if absolutely needed, use a thin red outline only
- **Privacy**: scrub any real client names, internal hostnames, or in-progress incident details from the Recent Reports widget before capturing (run against a fresh `reports/` dir if needed)
