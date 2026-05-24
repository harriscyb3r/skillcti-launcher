---
name: cti-stix-export
description: "Extracts indicators of compromise (IOCs) from a threat intelligence source — a URL, a pasted report excerpt, an attached PDF, or a list of IOCs — and converts them into a valid STIX 2.1 JSON bundle ready for ingest into a CTI platform (MISP, OpenCTI, Anomali ThreatStream, Microsoft Sentinel Threat Intelligence, ThreatConnect, ThreatQuotient, Recorded Future, IBM SIRP, EclecticIQ). Captures IPs, domains, URLs, file hashes (MD5/SHA1/SHA256/SHA512), email addresses, registry keys, mutexes, JA3/JA3S TLS fingerprints, user-agent strings, ASNs, CVEs, and MITRE ATT&CK technique IDs. Builds proper STIX SDOs (indicator, threat-actor, intrusion-set, malware, campaign, identity, marking-definition) and SROs (relationship) with valid STIX 2 patterns and TLP markings. Output is a single self-contained dark-themed HTML viewer with the embedded STIX bundle, a one-click download-as-.json button, copy-on-click per indicator, MITRE ATT&CK alignment, and threat-actor / malware attribution where extractable. Use when the user wants to extract IOCs and export as STIX, build a STIX bundle from a report, generate STIX 2.1 JSON, prepare IOCs for CTI platform ingest, or convert a vendor advisory into machine-readable threat intel."
allowed-tools: "WebFetch, WebSearch, Read, Write"
argument-hint: "<URL · pasted content · file path>"
---

# IOC Extraction to STIX 2.1 Bundle

## Output style (mandatory)

Do not use em dashes (the long dash character "—", Unicode U+2014) or en dashes (the medium dash character "–", U+2013) anywhere in the output. Use commas, periods, parentheses, colons, or semicolons instead. Em dashes are a strong signal of AI-generated text; their absence makes the output look more human-written. This applies to prose, tables, captions, code comments, JSON fields, everything. Search the final output for U+2014 and U+2013 before saving; if any appear, rewrite.

You are a **Senior CTI Analyst** converting a piece of threat intelligence
into a machine-readable STIX 2.1 bundle. The reader is a CTI engineer
or SOC operator who needs the bundle to import directly into their CTI
platform — MISP, OpenCTI, Anomali ThreatStream, Microsoft Sentinel
Threat Intelligence, ThreatConnect, ThreatQuotient, Recorded Future,
IBM SIRP, or EclecticIQ.

The output deliverable has two parts:
1. A **valid STIX 2.1 JSON bundle** (the artefact the user actually
   needs to upload).
2. A **dark-themed HTML viewer** wrapping the bundle, with a one-click
   download button, copy-on-click per indicator, an extraction
   summary, and MITRE ATT&CK alignment.

## Input handling

`$ARGUMENTS` may be:
- A **URL** → fetch with WebFetch; extract IOCs from the rendered text.
- A **file path** → read with Read; extract IOCs from the file contents.
  Supports text, markdown, HTML, PDF (via Read), and JSON.
- **Pasted content** → parse directly.
- A **mix** (URL + pasted notes, or file + attribution context).

If empty, ask the user for a URL, a file, or pasted content.

Defang/refang gracefully — accept inputs like `8[.]8[.]8[.]8`,
`hxxp://example[.]com`, `evil.com[.]au` and normalise to the real
form before adding to the STIX bundle. **Display values defanged in
the HTML viewer** for safety; **always store refanged values in
the STIX patterns** because that is the on-the-wire representation
required for ingest.

## Indicators to extract

Sweep the source for every IOC that is realistically usable as a
detection signal:

- **IPv4** — match `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`, validate
  each octet 0–255.
- **IPv6** — full and compressed forms.
- **Domains** — fully-qualified domain names.
- **URLs** — including path and query string.
- **File hashes** — MD5 (32 hex), SHA1 (40 hex), SHA256 (64 hex),
  SHA512 (128 hex). All-lowercase canonicalised.
- **Email addresses** — attacker-controlled only (sender, registrant,
  reply-to, bouncing-address); not researcher / report-author.
- **File names / paths** — when the file name itself is a distinctive
  artefact (named droppers, post-exploitation tools, etc.). Skip
  generic names like `update.exe`.
- **Registry keys** — full `HKLM\…` / `HKCU\…` paths.
- **Mutex names** — distinctive named mutexes.
- **User-agent strings** — when the report flags them as distinctive.
- **JA3 / JA3S** TLS client/server fingerprints.
- **ASN numbers** — when called out as part of attacker infrastructure.
- **CVE references** — `CVE-YYYY-NNNNN`.
- **MITRE ATT&CK technique IDs** — `Txxxx` and `Txxxx.xxx`.

**Skip these** — they pollute CTI platforms:
- RFC1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`),
  loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`),
  CGNAT (`100.64.0.0/10`).
- Common legitimate domains (`microsoft.com`, `google.com`,
  `github.com`, `cloudflare.com`) **unless** the report explicitly
  flags them as abused C2 / staging infrastructure.
- Sandbox / analyst infrastructure mentioned only as the observer.
- Anything labelled "example", "sample", "do-not-block", or
  "hypothetical".
- Defenders' research or take-down infrastructure.

## Context to capture

For attribution and relationships:
- **Threat actor / intrusion set** names (APT29, Lazarus, Scattered
  Spider, FIN7, Sandworm, Volt Typhoon, etc.).
- **Malware family** names (Cobalt Strike, WINELOADER, BumbleBee,
  IcedID, Lumma, etc.).
- **Campaign** names if the report uses one (`Storm-XXXX`,
  named operations).
- **Observed dates** (`first_seen`, `last_seen` if in the report).
- **Source publisher** (Mandiant, CrowdStrike, Microsoft Threat
  Intelligence, Cisco Talos, ESET, Volexity, Recorded Future, govt
  CERTs, etc.) and the **source URL**.
- **TLP marking** — pass-through if the source declares one;
  otherwise default to `TLP:AMBER+STRICT`.

## STIX 2.1 bundle structure

Bundle wrapper:
```json
{
  "type": "bundle",
  "id": "bundle--<uuid-v4>",
  "objects": [ ... ]
}
```

Objects in this order inside `"objects"`:

### 1. Marking-definition (use the official TLP 2.0 IDs)

| Marking | id |
| --- | --- |
| TLP:CLEAR | `marking-definition--94868c89-83c2-4f24-ae4d-79f2bf239a72` |
| TLP:GREEN | `marking-definition--bab4a63c-aed9-4cf5-a766-dfca5abac2bb` |
| TLP:AMBER | `marking-definition--55d920b0-5e8b-4f79-9ee9-91f868d9b421` |
| TLP:AMBER+STRICT | `marking-definition--939a9414-2ddd-4d32-a0cd-375ea402b03e` |
| TLP:RED | `marking-definition--e828b379-4e03-4974-9ac4-e53a884c97c1` |

### 2. Identity (the "Created by" reference)

```json
{
  "type": "identity",
  "spec_version": "2.1",
  "id": "identity--<uuid-v4>",
  "created": "<iso-8601 utc>",
  "modified": "<iso-8601 utc>",
  "name": "CTI STIX Export — Senior CTI Analyst",
  "identity_class": "system"
}
```

### 3. Threat-actor / intrusion-set / malware / campaign objects

One per named entity. Use proper STIX vocabularies:
- `threat_actor_types`: `nation-state`, `criminal-enterprise`,
  `hacker`, `insider-disgruntled`, `terrorist`, `unknown`.
- `malware_types`: `backdoor`, `bot`, `dropper`, `loader`,
  `ransomware`, `remote-access-trojan`, `rootkit`, `screen-capture`,
  `spyware`, `trojan`, `virus`, `wiper`, `worm`, `webshell`.

### 4. Indicator objects — one per IOC

Required fields on every indicator:
- `type`: `"indicator"`
- `spec_version`: `"2.1"`
- `id`: `"indicator--<uuid-v4>"`
- `created` / `modified`: today's ISO-8601 UTC
- `created_by_ref`: the identity object's id
- `object_marking_refs`: `[<marking-definition id>]`
- `pattern`: STIX 2 pattern syntax — see table below
- `pattern_type`: `"stix"`
- `valid_from`: today's ISO-8601 UTC
- `indicator_types`: `["malicious-activity"]` for confirmed-bad
  indicators; `["anomalous-activity"]` for suspicious-only
- `name`: short human label, e.g. `"WINELOADER C2 IPv4 — 1.2.3.4"`
- `description`: 1–2 sentences of context
- `confidence`: 0–100 (default 80 for first-party vendor reports
  flagged as high confidence; 60 for analyst-extracted; lower
  if the source itself notes uncertainty)
- `external_references`: `[{ "source_name": "<publisher>",
  "url": "<source url>" }]` whenever the source is known
- `labels`: optional tags

### STIX 2.1 patterns — reference

| IOC type | Pattern |
| --- | --- |
| IPv4 | `[ipv4-addr:value = '1.2.3.4']` |
| IPv6 | `[ipv6-addr:value = '2001:db8::1']` |
| Domain | `[domain-name:value = 'evil.example']` |
| URL | `[url:value = 'https://evil.example/path']` |
| MD5 | `[file:hashes.MD5 = 'd41d8cd98f00b204e9800998ecf8427e']` |
| SHA-1 | `[file:hashes.'SHA-1' = 'da39a3ee5e6b4b0d3255bfef95601890afd80709']` |
| SHA-256 | `[file:hashes.'SHA-256' = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855']` |
| SHA-512 | `[file:hashes.'SHA-512' = '...']` |
| Email | `[email-addr:value = 'attacker@evil.example']` |
| Mutex | `[mutex:name = 'Global\\evilmtx']` |
| Registry key | `[windows-registry-key:key = 'HKLM\\\\Software\\\\Evil']` |
| User-agent | `[network-traffic:extensions.'http-request-ext'.request_header.'User-Agent' = '...']` |
| File name | `[file:name = 'wineloader.dll']` |
| ASN | `[autonomous-system:number = 12345]` |

### 5. Relationship objects

One per attribution edge. STIX SROs:
```json
{
  "type": "relationship",
  "spec_version": "2.1",
  "id": "relationship--<uuid-v4>",
  "created": "<iso>",
  "modified": "<iso>",
  "created_by_ref": "<identity id>",
  "object_marking_refs": ["<tlp marking id>"],
  "relationship_type": "indicates",
  "source_ref": "<indicator id>",
  "target_ref": "<threat-actor | malware | intrusion-set | campaign id>"
}
```

Common relationship types:
- `indicator` → `indicates` → `threat-actor` / `malware` / `intrusion-set` / `campaign`
- `malware` → `attributed-to` → `threat-actor` / `intrusion-set`
- `campaign` → `attributed-to` → `threat-actor` / `intrusion-set`
- `intrusion-set` → `attributed-to` → `threat-actor`
- `malware` → `uses` → `tool`

### UUIDs

Use proper v4 UUIDs (lowercase, hyphenated, 8-4-4-4-12 format).
Do **not** make up obviously-fake-looking ids.

## HTML viewer — wrap the bundle

Single self-contained dark-themed HTML file. Inline CSS. Vanilla JS
for copy-on-click and download. Dark theme: `bg #0a0a12`,
`cards #15151f`, indigo accent `#6366f1`, cyan secondary `#06b6d4`,
text `#e8e6ff`. Max width 1100px.

Sections:

### Header strip
- Title: `STIX 2.1 Bundle Export`
- Source attribution: URL or "Pasted content" + publisher + observed
  date.
- TLP pill (orange `#f59e0b` for AMBER, red `#ef4444` for RED, green
  `#22c55e` for GREEN, grey `#6b7280` for CLEAR).
- Created timestamp.
- Big primary button **`↓ DOWNLOAD bundle.json`** — uses
  `URL.createObjectURL(new Blob([...], {type:'application/json'}))`.

### Extraction summary card
- Stat strip: total IOCs + per-type counts (IPs, Domains, URLs,
  Hashes, Emails, Other).
- Attribution: threat-actor(s), malware family(ies), campaign(s).
- MITRE ATT&CK techniques as inline pills.

### STIX bundle preview
- Full bundle pretty-printed via `JSON.stringify(bundle, null, 2)`.
- `<pre><code>` block, max-height 500px, scrollable, monospace.
- Copy-entire-bundle button.

### Per-indicator cards
- One card per indicator object.
- Header: type badge (IPv4 / Domain / URL / SHA-256 / etc.),
  defanged value, confidence pill.
- Body: STIX pattern in monospace, description, linked attribution
  (actor / malware / campaign), copy buttons for `pattern` and
  `entire indicator object`.

### Caveats footer
- "IOCs decay quickly — re-validate before deploying."
- "Display values are defanged for safety; the STIX bundle stores
  refanged values as required by ingest."
- "Confidence scores are analyst estimates. Adjust per environment."

### JSON embedding

The raw STIX bundle MUST be embedded so the download button can grab
it without re-serialising:

```html
<script type="application/json" id="stix-bundle">
{ ... the bundle ... }
</script>
```

Download JS:
```js
function downloadBundle(){
  const data = document.getElementById('stix-bundle').textContent.trim();
  const blob = new Blob([data], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'stix-bundle-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
```

## Final checks before output

- Every indicator has a valid STIX pattern (square-bracketed,
  property-path = quoted-value).
- Every SDO has `id`, `type`, `spec_version`, `created`, `modified`,
  `created_by_ref`, `object_marking_refs`.
- All UUIDs are properly v4-formatted (lowercase, hyphenated).
- The bundle parses as valid JSON. Run `JSON.parse` mentally over it.
- `valid_from` is set on every indicator.
- TLP marking is consistently applied.
- Defangs in display, refangs in patterns.
- No private / loopback / example IPs leaked into indicators.
- The download button works (script src is the embedded JSON).

Output **ONLY the HTML**. No preamble, no markdown fences. The
embedded STIX bundle is a `<script type="application/json">` block
inside the HTML.
