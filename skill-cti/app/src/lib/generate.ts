import type { Skill, Format } from './types'
import { HTML_STYLE_OVERRIDE, PDF_FORMAT_OVERRIDE, PPTX_OUTLINE_OVERRIDE, CITATION_REQUIREMENT } from './formatBlocks'

const MODEL = 'claude-sonnet-4-6'

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

function buildSystemPrompt(skillMd: string, format: Format): { type: string; text: string; cache_control?: { type: string } }[] {
  let formatBlock: string
  if (format === 'pdf') {
    formatBlock = PDF_FORMAT_OVERRIDE + '\n\n' + CITATION_REQUIREMENT
  } else if (format === 'pptx') {
    formatBlock = PPTX_OUTLINE_OVERRIDE
  } else {
    formatBlock = HTML_STYLE_OVERRIDE + '\n\n' + CITATION_REQUIREMENT
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

  if (format === 'pdf') {
    blocks.push({
      type: 'text',
      text: 'FINAL REMINDER: Your output MUST include a References section as the last section of the document. List every source you used with [n] numbers matching the inline citations. Do not omit references to shorten the document. The references section must be visible in the PDF — do not hide it with CSS.',
    })
  }

  return blocks
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
  const system = buildSystemPrompt(skillMd, format)
  const resolvedModel = model ?? skill.defaultModel ?? MODEL

  const body: Record<string, unknown> = {
    model: resolvedModel,
    max_tokens: skill.maxTokens ?? 8000,
    system,
    messages: [{ role: 'user', content: userMessage }],
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
  const system = buildSystemPrompt(skillMd, format)

  const resolvedModel = model ?? skill.defaultModel ?? MODEL
  onProgress?.(`Generating report…`)

  const body: Record<string, unknown> = {
    model: resolvedModel,
    max_tokens: skill.maxTokens ?? 8000,
    system,
    messages: [{ role: 'user', content: userMessage }],
  }

  if (skill.needsSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
  }

  const rawText = await generateStreaming(body, onProgress, onToken)
  const html = stripCodeFences(rawText)

  const reportId = `${skill.id}-${Date.now()}`
  const meta = {
    id: reportId,
    skillId: skill.id,
    skillName: skill.name,
    badge: skill.badge,
    badgeColor: skill.badgeColor,
    timestamp: new Date().toISOString(),
    title: skill.name,
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
    const blob = await pdfRes.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportId}.pdf`
    a.click()
    URL.revokeObjectURL(url)
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
    const blob = await pptxRes.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportId}.pptx`
    a.click()
    URL.revokeObjectURL(url)
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
