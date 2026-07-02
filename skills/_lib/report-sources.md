# Shared CTI source catalogue

The canonical source list for every CTI report skill. Each SKILL.md selects which sections to consult based on its audience (AU vs global) and scope (monthly vs sector).

Run WebSearch + WebFetch in parallel where possible. Aim for **≥ 2 sources per consumed category** per report.

---

## Australian government / regulator (primary)

Always include any output from these within the reporting window when a skill consumes this section.

- `cyber.gov.au` — ACSC alerts, advisories, threat reports, sector pages
- `asd.gov.au` — Australian Signals Directorate releases
- `oaic.gov.au` — notifiable data breach reports, OAIC announcements
- `homeaffairs.gov.au` — SOCI Act / Cyber and Infrastructure Security Centre (CISC) announcements
- `apra.gov.au` — CPS 234, prudential cyber guidance

## Australian sector regulators (for sector reports)

Add the sector-relevant entries as appropriate to the report's scope.

- `aemo.com.au`, `aer.gov.au` — energy market and reliability
- `acma.gov.au` — telecommunications
- `tga.gov.au` — therapeutic goods (medical device cyber)
- `arpansa.gov.au` — radiation / space-adjacent
- `austrac.gov.au` — financial intelligence (finance sector)
- `defence.gov.au` / DISP — defence industry security program
- `teqsa.gov.au`, `education.gov.au` — higher education

## Australian sector ISACs and industry bodies

- AusCERT (`auscert.org.au`) — multi-sector
- AISA (`aisa.org.au`) — cross-sector practitioner body
- AFMA, ABA — finance industry associations
- AEMO/AESCSF artefacts — energy sector cyber framework
- Communications Alliance — telco
- Australian Banking Association cyber working group
- Health Sector ISAC (where active), AHHA cyber materials

## Australian cyber media

- `itnews.com.au`
- `cyberdaily.au`
- `innovationaus.com`
- `abc.net.au` technology section
- `theguardian.com/au` technology
- `afr.com`, `theaustralian.com.au` cyber coverage
- `crikey.com.au` cyber coverage

---

## Government / regulator / CERT — global (for global reports)

Weight selection toward the chosen region but always include at least the major Five Eyes + EU outputs for global context.

| Region | Sources |
| --- | --- |
| **USA** | `cisa.gov` (alerts, advisories, KEV catalog), `fbi.gov/ic3`, `whitehouse.gov` (cyber EO updates), `sec.gov`, `hhs.gov` OCR, `ffiec.gov`, `dfs.ny.gov` (NYDFS), `tsa.gov`, `nerc.com`, `fda.gov` |
| **UK** | `ncsc.gov.uk`, `ico.org.uk`, `fca.org.uk`, `bankofengland.co.uk/pra` |
| **EU** | `enisa.europa.eu`, `cert.europa.eu`, `edpb.europa.eu` (GDPR) |
| **Germany** | `bsi.bund.de`, `bafin.de`, cert-bund |
| **France** | `cyber.gouv.fr`, `cert.ssi.gouv.fr` (ANSSI / CERT-FR), `cnil.fr` |
| **Netherlands** | `ncsc.nl`, `dnb.nl` |
| **Italy** | `acn.gov.it` / `csirt.gov.it` |
| **Spain** | `incibe-cert.es` |
| **Canada** | `cyber.gc.ca` (CCCS), `osfi-bsif.gc.ca`, `priv.gc.ca` (OPC) |
| **Australia** | See AU section above. |
| **New Zealand** | `ncsc.govt.nz`, `cert.govt.nz` |
| **Japan** | `jpcert.or.jp`, `nisc.go.jp`, `fsa.go.jp` |
| **South Korea** | `krcert.or.kr` (KISA) |
| **Singapore** | `csa.gov.sg`, `mas.gov.sg` |
| **India** | `cert-in.org.in` |
| **Israel** | `gov.il` national cyber directorate |

---

## Global sector ISACs (for global sector reports)

- FS-ISAC (financial services)
- H-ISAC (health)
- E-ISAC (electricity), DNG-ISAC (downstream natural gas)
- Auto-ISAC (automotive)
- Aviation ISAC, Maritime ISAC
- Space ISAC
- IT-ISAC, Communications ISAC
- WaterISAC
- Retail and Hospitality ISAC (RH-ISAC)
- Education ISACs (REN-ISAC for higher ed)
- CERT-CC (sector-agnostic, Carnegie Mellon)

---

## Global cyber media

- `bleepingcomputer.com`
- `thehackernews.com`
- `therecord.media`
- `securityweek.com`
- `darkreading.com`
- `krebsonsecurity.com`
- `risky.biz`

## Regional cyber media (where the report sets a region)

| Region | Sources |
| --- | --- |
| US | `cyberscoop.com`, `nextgov.com`, washingtonpost.com cyber coverage |
| UK | `theregister.com` (UK-leaning), `computing.co.uk` |
| EU | `euronews.com` cyber, `politico.eu` cyber |
| Japan | `japantimes.co.jp` tech, `nikkei.com` cyber |
| Australia | See AU media section above. |

---

## Vulnerability sources

- `nvd.nist.gov`
- `cve.org`
- `cisa.gov/known-exploited-vulnerabilities-catalog` (CISA KEV)
- FIRST EPSS (`first.org/epss`) — exploit-probability scoring
- CISA SSVC (`cisa.gov/ssvc`) — decision-tree categorisation
- Vendor advisories: Microsoft MSRC, Cisco PSIRT, Fortinet PSIRT, Ivanti, Atlassian, Citrix, Palo Alto, VMware

## Sector-specific vendor advisories (for sector reports)

- **OT / ICS** — Siemens, Schneider, Rockwell, Honeywell
- **Health** — Epic, Cerner, Philips, GE Healthcare
- **Finance** — Temenos, Murex, Finastra
- **Manufacturing / ERP** — SAP, Oracle
- **Aviation** — Boeing, Honeywell avionics
- **Maritime** — Wartsila, Kongsberg

---

## Threat-intel vendor blogs and annual reports

- Mandiant — `mandiant.com` / `cloud.google.com/blog/topics/threat-intelligence` (M-Trends annual)
- CrowdStrike — `crowdstrike.com/blog` (Global Threat Report annual)
- Microsoft Threat Intelligence — `microsoft.com/security/blog` (Digital Defense Report annual)
- Palo Alto Unit 42 — `unit42.paloaltonetworks.com`
- Cisco Talos — `talosintelligence.com/blog`
- Recorded Future — `recordedfuture.com/blog`
- Volexity, ESET, Trend Micro, Kaspersky GReAT, Group-IB, Sekoia.io, Proofpoint
- Verizon DBIR — sector breakdowns
- IBM X-Force Threat Intelligence Index — sector breakdowns
- IBM Cost of a Data Breach Report — annual financial impact data
- ENISA Threat Landscape — sector annexes (for sector reports)
