import type { Skill, Format } from './types'
import { MD_REPORT_FORMAT, MD_CITATION_REQUIREMENT, MD_REFERENCES_REMINDER, MD_HAIKU_ADDENDUM, PPTX_OUTLINE_OVERRIDE } from './formatBlocks'

const MODEL = 'claude-sonnet-4-6'

// ── MISP context injection ──────────────────────────────────────────────────
// Maps skill IDs to the MISP query type and look-back window.
const MISP_SKILL_CONFIG: Record<string, { type: string; days: number }> = {
  'daily-brief-global':   { type: 'daily',        days: 7   },
  'operational':          { type: 'operational',  days: 30  },
  'operational-au':       { type: 'operational',  days: 30  },
  'operational-global':   { type: 'operational',  days: 30  },
  'tactical':             { type: 'tactical',     days: 30  },
  'tactical-au':          { type: 'tactical',     days: 30  },
  'tactical-global':      { type: 'tactical',     days: 30  },
  'strategic':            { type: 'strategic',    days: 90  },
  'strategic-au':         { type: 'strategic',    days: 90  },
  'strategic-global':     { type: 'strategic',    days: 90  },
  'sector':               { type: 'sector',       days: 90  },
  'sector-au':            { type: 'sector',       days: 90  },
  'sector-global':        { type: 'sector',       days: 90  },
  'threat-actor-profile': { type: 'threat-actor', days: 365 },
  'tabletop':             { type: 'threat-actor', days: 365 },
  'bas-red-team':         { type: 'threat-actor', days: 365 },
  'security-advisory':    { type: 'advisory',     days: 90  },
}

function extractMispQuery(skillId: string, userMessage: string): string {
  if (skillId === 'threat-actor-profile') {
    // userMessage: "APT29 / Midnight Blizzard\nReader context: …"
    // Skip pure-URL lines; take the first non-empty, non-URL line as the actor name.
    const actorLine = userMessage.split('\n')
      .map(l => l.trim())
      .find(l => l && !l.startsWith('http') && !l.startsWith('Reader context:'))
    return actorLine ?? ''
  }
  if (skillId === 'tabletop') {
    // userMessage: "APT29 / Midnight Blizzard [Duration: 2 hours] [Audience: CISO + IR Team]"
    // Strip bracket metadata and URL lines; take the actor name portion.
    const stripped = userMessage.replace(/\[.*?\]/g, '').trim()
    const actorLine = stripped.split('\n')
      .map(l => l.trim())
      .find(l => l && !l.startsWith('http'))
    return actorLine ?? ''
  }
  if (skillId === 'bas-red-team') {
    // userMessage includes "\n\nThreat actor profile: APT29" when set
    const m = userMessage.match(/Threat actor profile:\s*(.+)/i)
    return m ? m[1].trim() : ''
  }
  if (skillId === 'security-advisory') {
    // userMessage: "CVE-2024-12345\nRegion: Global"
    const queryLine = userMessage.split('\n')
      .map(l => l.trim())
      .find(l => l && !l.startsWith('Region:'))
    return queryLine ?? ''
  }
  if (skillId === 'sector' || skillId === 'sector-au' || skillId === 'sector-global') {
    // userMessage: "Sector: Healthcare [Horizon: 12 months]"
    const m = userMessage.match(/Sector:\s*([^\[]+)/i)
    return m ? m[1].trim() : ''
  }
  return ''
}

async function fetchMispContext(skillId: string, userMessage: string): Promise<string | null> {
  const config = MISP_SKILL_CONFIG[skillId]
  if (!config) return null

  const query = extractMispQuery(skillId, userMessage)
  const params = new URLSearchParams({ skill_type: config.type, days: String(config.days) })
  if (query) params.set('query', query)

  const res = await fetch(`/misp/context?${params}`)
  if (!res.ok) return null
  const data: { has_data: boolean; context: string | null } = await res.json()
  return data.has_data ? data.context : null
}

function stripFrontmatter(md: string): string {
  return md.replace(/^---[\s\S]*?---\s*/m, '').trim()
}

function stripCodeFences(text: string): string {
  // Drop any prose before the opening fence, then strip fences
  const fenceStart = text.indexOf('```')
  if (fenceStart !== -1) {
    text = text.slice(fenceStart)
  }
  text = text.replace(/^```(?:html|json)?\s*/i, '').replace(/```\s*$/, '').trim()

  // 1. Drop prose BEFORE <!DOCTYPE html> / <html  (outside the document entirely)
  const htmlStart = text.search(/<!DOCTYPE\s+html|<html[\s>]/i)
  if (htmlStart > 0) {
    text = text.slice(htmlStart)
  }

  // 2. Drop prose AFTER </html>  (outside the document entirely)
  const htmlEndMatch = text.match(/<\/html\s*>/i)
  if (htmlEndMatch && htmlEndMatch.index !== undefined) {
    text = text.slice(0, htmlEndMatch.index + htmlEndMatch[0].length)
  }

  // 3. Drop plain-text narration that lands as the FIRST text node inside <body>
  //    before any HTML element. Claude sometimes inserts research notes there.
  //    Only strips runs of text with no angle brackets (i.e. no embedded tags).
  text = text.replace(/(<body[^>]*>)\s*[^<]+\s*(?=<)/i, '$1')

  // 4. Drop plain-text narration that lands as the LAST text node inside <body>
  //    after all HTML elements but before </body>. Same constraint — no tags.
  text = text.replace(/(?<=>)\s*[^<]+\s*(<\/body>)/i, '$1')

  return text
}

async function fetchSkillMd(skillPath: string): Promise<string> {
  const res = await fetch(`/skill/${skillPath}`)
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Failed to load skill prompt (${res.status}): ${body}`)
  }
  const text = await res.text()
  return stripFrontmatter(text)
}

function buildSystemPrompt(skillMd: string, format: Format, model?: string): { type: string; text: string; cache_control?: { type: string } }[] {
  const isHaiku = (model ?? '').toLowerCase().includes('haiku')

  let formatBlock: string
  if (format === 'pptx') {
    formatBlock = PPTX_OUTLINE_OVERRIDE
  } else {
    // html and pdf both use markdown mode — the backend renders the
    // template server-side (POST /api/render)
    formatBlock = MD_REPORT_FORMAT + '\n\n' + MD_CITATION_REQUIREMENT
  }

  const contentSpec =
    '══════════════════════════════════════════════════════════\n' +
    'CONTENT SPECIFICATION FOR THIS SKILL\n' +
    '══════════════════════════════════════════════════════════\n\n' +
    skillMd

  const blocks: { type: string; text: string; cache_control?: { type: string } }[] = [
    {
      type: 'text',
      text: formatBlock,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: contentSpec,
      cache_control: { type: 'ephemeral' },
    },
  ]

  if (isHaiku && format !== 'pptx') {
    blocks.push({ type: 'text', text: MD_HAIKU_ADDENDUM })
  }

  if (format === 'pdf') {
    blocks.push({ type: 'text', text: MD_REFERENCES_REMINDER })
  }

  return blocks
}

/** Render structured report markdown into the fixed HTML template server-side.
 *  Legacy full-HTML model output passes through unchanged. */
async function renderReport(
  raw: string,
  mode: 'dark' | 'pdf',
  skill: Skill,
): Promise<{ html: string; title: string }> {
  const looksHtml = /<!DOCTYPE\s+html|<html[\s>]/i.test(raw.slice(0, 400))
  if (looksHtml) {
    return { html: stripCodeFences(raw), title: skill.name }
  }
  const res = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown: raw, mode, skill_name: skill.name, badge: skill.badge }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Report render failed (${res.status}): ${err}`)
  }
  return res.json()
}

export interface GenerateResult {
  html: string
  reportId?: string
}

export interface GenerateOptions {
  skill: Skill
  format: Format
  userMessage: string
  model?: string
  onProgress?: (msg: string) => void
  onToken?: (partial: string) => void
}

async function generateStreaming(
  body: Record<string, unknown>,
  onProgress: ((msg: string) => void) | undefined,
  onToken: ((partial: string) => void) | undefined,
): Promise<string> {
  const res = await fetch('/v1/messages/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''
  let buffer = ''
  let errorSeen = false

  onProgress?.('Receiving response...')

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (!raw || raw === '[DONE]') continue

      let event: Record<string, unknown>
      try {
        event = JSON.parse(raw)
      } catch {
        continue
      }

      // Error forwarded from backend
      if ((event.type as string) === 'error' || event.error) {
        errorSeen = true
        throw new Error(`Anthropic error: ${JSON.stringify(event.error ?? event)}`)
      }

      if (
        (event.type as string) === 'content_block_delta' &&
        (event.delta as Record<string, unknown>)?.type === 'text_delta'
      ) {
        const chunk = ((event.delta as Record<string, unknown>).text as string) ?? ''
        accumulated += chunk
        onToken?.(accumulated)
      }
    }

    if (errorSeen) break
  }

  return accumulated
}

export interface BackgroundJobOptions {
  skill: Skill
  format: Format
  userMessage: string
  model?: string
}

export async function submitBackgroundJob({ skill, format, userMessage, model }: BackgroundJobOptions): Promise<{ job_id: string; report_id: string }> {
  const skillMd = await fetchSkillMd(skill.skillPath!)
  const resolvedModel = model ?? skill.defaultModel ?? MODEL
  const system = buildSystemPrompt(skillMd, format, resolvedModel)

  // Silently enrich with MISP context when available — never block the job on failure
  let enrichedMessage = userMessage
  try {
    const mispCtx = await fetchMispContext(skill.id, userMessage)
    if (mispCtx) enrichedMessage = `${userMessage}\n\n${mispCtx}`
  } catch { /* MISP is optional */ }

  const body: Record<string, unknown> = {
    model: resolvedModel,
    max_tokens: skill.maxTokens ?? 8000,
    system,
    messages: [{ role: 'user', content: enrichedMessage }],
  }
  if (skill.needsSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
  }

  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      skill_id: skill.id,
      skill_name: skill.name,
      badge: skill.badge,
      badge_color: skill.badgeColor,
      format,
      anthropic_body: body,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to start background job: ${err}`)
  }
  return res.json()
}

export async function generate({ skill, format, userMessage, model, onProgress, onToken }: GenerateOptions): Promise<GenerateResult> {
  onProgress?.('Loading skill prompt...')

  const skillMd = await fetchSkillMd(skill.skillPath!)
  const resolvedModel = model ?? skill.defaultModel ?? MODEL
  const system = buildSystemPrompt(skillMd, format, resolvedModel)

  // Silently enrich with MISP context when available
  let enrichedMessage = userMessage
  try {
    const mispCtx = await fetchMispContext(skill.id, userMessage)
    if (mispCtx) enrichedMessage = `${userMessage}\n\n${mispCtx}`
  } catch { /* MISP is optional */ }

  onProgress?.(`Generating report…`)

  const body: Record<string, unknown> = {
    model: resolvedModel,
    max_tokens: skill.maxTokens ?? 8000,
    system,
    messages: [{ role: 'user', content: enrichedMessage }],
  }

  if (skill.needsSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
  }

  const rawText = await generateStreaming(body, onProgress, onToken)

  let html: string
  let reportTitle = skill.name
  if (format === 'pptx') {
    html = stripCodeFences(rawText)
  } else {
    onProgress?.('Rendering report...')
    const rendered = await renderReport(rawText, format === 'pdf' ? 'pdf' : 'dark', skill)
    html = rendered.html
    reportTitle = rendered.title || skill.name
  }

  const reportId = `${skill.id}-${Date.now()}`
  const meta = {
    id: reportId,
    skillId: skill.id,
    skillName: skill.name,
    badge: skill.badge,
    badgeColor: skill.badgeColor,
    timestamp: new Date().toISOString(),
    title: reportTitle,
    inputs: {},
  }

  if (format === 'pdf') {
    onProgress?.('Generating PDF...')
    const pdfRes = await fetch('/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta: { ...meta, format: 'pdf' }, html }),
    })
    if (!pdfRes.ok) {
      const body = await pdfRes.text().catch(() => pdfRes.statusText)
      throw new Error(`PDF export failed (${pdfRes.status}): ${body}`)
    }
    // PDF is saved server-side in the reports folder — no browser download dialog needed
    await pdfRes.blob()
    return { html }
  }

  if (format === 'pptx') {
    onProgress?.('Building PowerPoint...')
    let outline: unknown
    try {
      outline = JSON.parse(html)
    } catch {
      throw new Error('Model returned invalid JSON for PPTX outline')
    }
    const pptxRes = await fetch('/generate-pptx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta: { ...meta, format: 'pptx' }, outline }),
    })
    if (!pptxRes.ok) {
      const body = await pptxRes.text().catch(() => pptxRes.statusText)
      throw new Error(`PPTX export failed (${pptxRes.status}): ${body}`)
    }
    // PPTX is saved server-side in the reports folder — no browser download dialog needed
    await pptxRes.blob()
    return { html: '' }
  }

  // HTML — save to reports store
  onProgress?.('Saving report...')
  const saveRes = await fetch('/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meta: { ...meta, format: 'html', bytes: new Blob([html]).size }, html }),
  })
  if (!saveRes.ok) {
    const errBody = await saveRes.text().catch(() => saveRes.statusText)
    throw new Error(`Failed to save report (${saveRes.status}): ${errBody}`)
  }
  const saved = await saveRes.json()

  return { html, reportId: saved.id }
}
