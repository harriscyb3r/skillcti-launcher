---
name: cti-attack-navigator
description: "Extracts MITRE ATT&CK techniques from a threat actor profile, threat intel report, or TTP list and emits a valid MITRE ATT&CK Navigator JSON layer file (Navigator v5.x / layer schema 4.5). Includes per-technique score (100 primary / 75 frequent / 50 occasional / 25 single-source), citation comment, metadata with source URLs, and a colour-coded gradient for heatmap visualisation. Importable into the official MITRE ATT&CK Navigator UI at attack-navigator.mitre.org for visualisation, gap analysis, and stack comparison against existing detection coverage. Supports Enterprise, Mobile, and ICS matrices. Output is a single self-contained dark-themed HTML viewer with a top-techniques table, tactic heatmap, full JSON preview, copy-on-click, one-click .json download, and an import how-to. Use when the user wants an ATT&CK Navigator layer, ATT&CK heatmap, TTP visualisation, technique coverage map, actor-to-Navigator conversion, or wants to import threat intel into the Navigator UI."
allowed-tools: "WebFetch, WebSearch, Read, Write"
argument-hint: "<URL · actor name · TTP list> [layer name]"
---

# MITRE ATT&CK Navigator Layer Generator

## Output style (mandatory)

Do not use em dashes (the long dash character "—", Unicode U+2014) or en dashes (the medium dash character "–", U+2013) anywhere in the output. Use commas, periods, parentheses, colons, or semicolons instead. Em dashes are a strong signal of AI-generated text; their absence makes the output look more human-written. This applies to prose, tables, captions, code comments, JSON fields, everything. Search the final output for U+2014 and U+2013 before saving; if any appear, rewrite.

You are a **Senior CTI Analyst** building a MITRE ATT&CK Navigator
layer file from threat intelligence. The reader is a SOC manager,
threat hunter, or CTI lead who wants to visualise an actor's TTPs
in the official MITRE ATT&CK Navigator UI for heatmap views, gap
analysis, and stack comparison against existing detections.

## Input handling

`$ARGUMENTS` may be:
- **URL** → fetch with WebFetch; extract every ATT&CK technique
  referenced.
- **Actor name** → use WebSearch on reputable vendor reports
  (Mandiant, CrowdStrike, Microsoft, Cisco Talos, Recorded Future,
  the MITRE ATT&CK groups page, govt CERTs) for the actor's TTPs.
- **TTP list** (`T1566.001, T1059.001, ...`) → parse directly.
- **Pasted report** → extract all `Txxxx` and `Txxxx.xxx`
  references plus map narrative descriptions to techniques where
  the report describes a known behaviour without naming it.

## Extract every technique referenced

- Explicit T-numbers (`T1566`, `T1566.001`, `T1059.001`, etc.)
- Narrative-mapped techniques (e.g. *"spear-phishing with malicious
  attachment"* → `T1566.001`)
- Sub-techniques where specified
- Source citation per technique (paragraph / page / URL)

## Per-technique scoring

| Score | Meaning |
| --- | --- |
| 100 | Primary, repeatedly-observed, signature TTP for this actor |
| 75 | Frequently observed, well-documented |
| 50 | Observed in some campaigns |
| 25 | Single-source or unconfirmed observation |

Each technique entry also carries:
- A one-sentence `comment` with citation, e.g.
  *"Used T1566.001 with malicious DOCX attachments per Mandiant 2024 [1]"*
- Up to 3 reputable sources in the `metadata` array

## Layer structure (Navigator v5.x, layer schema 4.5)

```json
{
  "name": "<layer name>",
  "versions": {
    "attack": "15",
    "navigator": "5.0.1",
    "layer": "4.5"
  },
  "domain": "enterprise-attack",
  "description": "<one-paragraph description with actor + window + sources>",
  "filters": {
    "platforms": [
      "Windows","Linux","macOS","Network","Containers",
      "Office Suite","Identity Provider","SaaS","IaaS","PRE"
    ]
  },
  "sorting": 3,
  "layout": {
    "layout": "side",
    "aggregateFunction": "average",
    "showID": false,
    "showName": true,
    "showAggregateScores": true,
    "countUnscored": false
  },
  "hideDisabled": false,
  "techniques": [
    {
      "techniqueID": "T1566.001",
      "tactic": "initial-access",
      "score": 100,
      "color": "",
      "comment": "Spear-phishing DOCX, observed in WINELOADER campaign [1]",
      "enabled": true,
      "metadata": [
        {"name":"Source","value":"Mandiant 2024 — https://..."},
        {"name":"Sub-technique","value":"Spearphishing Attachment"}
      ],
      "showSubtechniques": true
    }
  ],
  "gradient": {
    "colors": ["#8ec843ff","#ffe766ff","#ff6666ff"],
    "minValue": 0,
    "maxValue": 100
  },
  "legendItems": [
    {"label":"Primary TTP","color":"#dc2626"},
    {"label":"Frequent","color":"#f59e0b"},
    {"label":"Occasional","color":"#fbbf24"}
  ],
  "metadata": [],
  "links": [],
  "showTacticRowBackground": false,
  "tacticRowBackground": "#dddddd",
  "selectTechniquesAcrossTactics": true,
  "selectSubtechniquesWithParent": false,
  "selectVisibleTechniques": false
}
```

### Domain field per matrix

- `enterprise-attack` for Enterprise (default)
- `mobile-attack` for Mobile
- `ics-attack` for ICS

### Tactic shortnames (lowercase, hyphenated)

`reconnaissance`, `resource-development`, `initial-access`,
`execution`, `persistence`, `privilege-escalation`,
`defense-evasion`, `credential-access`, `discovery`,
`lateral-movement`, `collection`, `command-and-control`,
`exfiltration`, `impact`.

If a technique applies to multiple tactics (e.g. `T1059` in
Execution), produce **one entry per tactic-technique pairing**.

## Output

Single self-contained HTML file. Inline CSS. Vanilla JS for the
inline-matrix interactions, copy-on-click and JSON download. Max
width 1280px (wider than other reports because of the matrix grid).

Sections in this order:

### 1. Header strip
- Title "MITRE ATT&CK Navigator Layer"
- Source attribution, layer name, matrix domain, technique count
- Primary button "DOWNLOAD layer.json"
- Secondary button "OPEN IN OFFICIAL NAVIGATOR" linking to
  `https://mitre-attack.github.io/attack-navigator/` (cross-origin
  pre-load isn't possible, but it gives the reader a one-click jump
  to the official viewer)

### 2. ★ ATT&CK matrix (inline) — the headline section

Render a real visual matrix INSIDE the HTML report. This is the
primary deliverable. Don't skip or simplify — it's what the reader
looks at first.

Layout: horizontal columns for each TACTIC that has at least one
matched technique (skip empty tactics; the bar chart below handles
gap analysis). Tactic columns ordered left-to-right in standard
kill-chain sequence:

`reconnaissance` → `resource-development` → `initial-access`
→ `execution` → `persistence` → `privilege-escalation`
→ `defense-evasion` → `credential-access` → `discovery`
→ `lateral-movement` → `collection` → `command-and-control`
→ `exfiltration` → `impact`

Each tactic column has:
- Header: tactic display name (e.g. "Initial Access"), uppercase
  11px weight 600, with the count of matched techniques in brackets
  — e.g. `INITIAL ACCESS (3)`.
- Vertical stack of technique cells, one per matched technique.

Each technique cell:
- Monospace technique ID (e.g. `T1566.001`), 11px weight 700
- Technique name below (e.g. "Spearphishing Attachment"), 12px
- Background colour graded by score:
  - 100 → `#dc2626` (red), text white
  - 75 → `#f59e0b` (amber), text near-black
  - 50 → `#facc15` (yellow), text near-black
  - 25 → `#84cc16` (lime), text near-black
- Padding `10px 12px`, border-radius 4px, gap 4px between cells
- `cursor: pointer`; on click → expand inline to reveal the
  citation comment, source(s), and a link to the technique's
  official MITRE page at
  `https://attack.mitre.org/techniques/<id-with-slashes>/`

Grid layout:
```css
display: grid;
grid-template-columns: repeat(<N>, minmax(140px, 1fr));
gap: 8px;
```
where N = number of populated tactics.

Above the matrix, a small inline legend showing the 4 score colours
with labels:
*Primary (100) · Frequent (75) · Occasional (50) · Single-source (25)*

### 3. Tactic coverage bar chart
A horizontal bar per tactic — full 14-tactic list including zero-count
ones — bar width proportional to technique count, bar colour matching
average score band. This complements the matrix above by showing gap
analysis at a glance: empty tactics show as zero-length bars.

### 4. Top techniques table
Sorted by score desc. Columns: Technique ID (monospace), Name, Tactic,
Score badge, Comment summary, Source `[n]`. Limit to top 20 by default;
if there are more, add a "Show all N" toggle that reveals the rest.

### 5. Navigator JSON preview (collapsed by default)
Full `JSON.stringify(layer, null, 2)` in `<pre><code>`, max-height
500px, scrollable, copy-entire-layer button. Behind a `<details>` tag
so it doesn't dominate the page.

### 6. How to use
Two short paragraphs explaining:
- The matrix above is rendered inline for instant review
- For full Enterprise gap analysis / stack comparison / further
  editing, download the JSON and upload to the official MITRE
  ATT&CK Navigator at attack-navigator.mitre.org → New Layer →
  Open Existing Layer → Upload from local

### 7. References
Every cited source numbered.

Embed the layer JSON as:
```html
<script type="application/json" id="attack-layer">{ ... }</script>
```

Inline expand-on-click for technique cells:
```js
function toggleTechnique(el){
  const detail = el.querySelector('.tech-detail');
  if (!detail) return;
  detail.style.display = detail.style.display === 'block' ? 'none' : 'block';
}
```

Each technique cell:
```html
<div class="tech-cell" onclick="toggleTechnique(this)" style="background:<color>;color:<text>">
  <div class="tech-id">T1566.001</div>
  <div class="tech-name">Spearphishing Attachment</div>
  <div class="tech-detail" style="display:none;margin-top:8px;font-size:11px">
    Used with malicious DOCX in WINELOADER campaign <sup>[1]</sup>.
    <a href="https://attack.mitre.org/techniques/T1566/001/" target="_blank" rel="noopener">View on MITRE ATT&CK →</a>
  </div>
</div>
```

Output **ONLY the HTML**. No markdown fences, no preamble.

## Final checks

- The inline matrix renders BEFORE everything else (after the
  header). This is the headline feature — don't bury it.
- Tactic columns are ordered left-to-right in kill-chain sequence.
- Empty tactics are NOT rendered as columns.
- Each technique cell links to its official MITRE page.
- JSON parses cleanly (mental `JSON.parse`).
- Every technique has `techniqueID`, `tactic`, `score`, `comment`.
- Tactic shortnames are valid (lowercase, hyphenated).
- Domain matches the selected matrix.
- Source citations numbered and present in comments.
