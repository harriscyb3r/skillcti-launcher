import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { toast } from '../lib/useToast'

// ── constants ─────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096
const HISTORY_KEY = 'skillcti:analyst:history'
const PENDING_KEY = 'skillcti:pending-prompt'
const MAX_HISTORY = 30

const SYSTEM_PROMPT = `You are a senior Cyber Threat Intelligence analyst embedded in SkillCTI, an analyst workbench. Answer any cybersecurity or threat intelligence question with the depth and precision of an experienced practitioner.

Your expertise spans: threat actor attribution and profiling (nation-state APTs, ransomware groups, hacktivists, initial access brokers); MITRE ATT&CK TTPs and threat modelling; vulnerability research, CVE analysis, CVSS/EPSS, exploitation timelines; malware families, C2 infrastructure, behavioural indicators; incident response and DFIR; threat hunting and detection engineering (Sigma, KQL, YARA, Splunk SPL); security operations (SIEM, EDR, NDR, SOAR); frameworks (NIST CSF 2.0, ASD Essential Eight, ISO 27001, ACSC guidelines, SOCI Act, APRA CPS 234, NIS2, DORA); and the Australian and APAC threat landscape.

Style guidelines:
- Begin directly with the answer — no preamble, no "Great question", no acknowledgement
- Use markdown: headers for structure, bullet points for lists, tables for comparisons, fenced code blocks for rules and scripts
- Cite ATT&CK technique IDs (e.g. T1566.001), CVE IDs, threat actor aliases, and real incidents where relevant
- If a question may involve events after your knowledge cutoff, flag it briefly and suggest current sources`

const SUGGESTIONS = [
  'Who is Scattered Spider and what are their key TTPs?',
  'What MITRE ATT&CK techniques are most commonly used in ransomware attacks?',
  'Explain EPSS scoring and how to prioritise CVE remediation',
  'What threat actors are actively targeting Australian critical infrastructure?',
  'What is the difference between strategic, operational, and tactical CTI?',
]

// ── types ─────────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant'
type Message = { role: Role; content: string }

type SavedConversation = {
  id: string
  title: string
  updatedAt: string
  messages: Message[]
}

// ── storage helpers ───────────────────────────────────────────────────────────

function loadHistory(): SavedConversation[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistHistory(history: SavedConversation[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch {}
}

function titleFromMessages(messages: Message[]): string {
  const first = messages.find((m) => m.role === 'user')?.content ?? 'New conversation'
  return first.length > 60 ? first.slice(0, 60) + '…' : first
}

function relativeTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── streaming ─────────────────────────────────────────────────────────────────

async function streamChat(
  messages: Message[],
  useWebSearch: boolean,
  onToken: (accumulated: string) => void,
  onSearching: (active: boolean) => void,
  signal: AbortSignal,
  mispContext?: string | null,
): Promise<void> {
  const systemBlocks: Record<string, unknown>[] = [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ]
  if (mispContext) {
    systemBlocks.push({ type: 'text', text: mispContext })
  }
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemBlocks,
    messages,
  }
  if (useWebSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
  }

  const res = await fetch('/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      try {
        const event = JSON.parse(line.slice(5).trim())
        if (event.type === 'content_block_start') {
          if (event.content_block?.type === 'tool_use') onSearching(true)
          if (event.content_block?.type === 'text') onSearching(false)
        }
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          accumulated += event.delta.text ?? ''
          onToken(accumulated)
        }
      } catch {}
    }
  }
}

// ── markdown renderer ─────────────────────────────────────────────────────────

function MarkdownContent({ text }: { text: string }) {
  const segments = text.split(/(```[\w.-]*\n[\s\S]*?```|```[\w.-]*\n[\s\S]*)/g)
  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        const m = seg.match(/^```([\w.-]*)\n([\s\S]*)```$/) || seg.match(/^```([\w.-]*)\n([\s\S]*)$/)
        if (m) {
          const lang = m[1].trim()
          const code = m[2].replace(/```$/, '').trimEnd()
          return (
            <div key={i} className="rounded-lg border border-border overflow-hidden text-[11px]">
              {lang && (
                <div className="bg-bg border-b border-border px-3 py-1 font-mono text-txt-3 uppercase tracking-wider text-[10px]">
                  {lang}
                </div>
              )}
              <pre className="bg-bg px-4 py-3 font-mono text-txt overflow-x-auto leading-relaxed whitespace-pre">
                <code>{code}</code>
              </pre>
            </div>
          )
        }
        if (!seg) return null
        return (
          <p key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed text-txt">{seg}</p>
        )
      })}
    </div>
  )
}

// ── message bubbles ───────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-purple/10 border border-purple/25 rounded-[10px] px-4 py-3">
        <p className="text-[13px] text-txt whitespace-pre-wrap leading-relaxed">{content}</p>
      </div>
    </div>
  )
}

function AssistantBubble({
  content, streaming, searching,
}: { content: string; streaming: boolean; searching: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-md bg-gradient-to-br from-purple to-cyan flex items-center justify-center mt-0.5">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        {searching && !content && (
          <div className="flex items-center gap-2 text-txt-3 text-[11px] font-mono py-1">
            <div className="flex gap-1">
              {[0, 150, 300].map((d) => (
                <span key={d} className="w-1.5 h-1.5 rounded-full bg-txt-3 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            Searching the web…
          </div>
        )}
        {content ? (
          <>
            <MarkdownContent text={content} />
            {streaming && (
              <span className="inline-block w-[2px] h-[14px] bg-purple ml-0.5 animate-pulse align-middle" />
            )}
          </>
        ) : !searching ? (
          <div className="flex items-center gap-1 py-1">
            {[0, 150, 300].map((d) => (
              <span key={d} className="w-1.5 h-1.5 rounded-full bg-txt-3 animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── history sidebar ───────────────────────────────────────────────────────────

function HistorySidebar({
  history,
  activeId,
  onLoad,
  onDelete,
  onNew,
}: {
  history: SavedConversation[]
  activeId: string | null
  onLoad: (conv: SavedConversation) => void
  onDelete: (id: string) => void
  onNew: () => void
}) {
  return (
    <div className="flex flex-col w-[210px] flex-shrink-0 border-r border-border bg-gradient-to-b from-surface to-bg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border flex-shrink-0">
        <span className="text-[11px] font-bold tracking-[0.18em] text-txt-3 uppercase">History</span>
        <button
          onClick={onNew}
          title="New conversation"
          className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer transition-colors px-1"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {history.length === 0 ? (
          <p className="text-[11px] text-txt-3 px-3 py-4 text-center leading-relaxed">
            No saved conversations yet.
          </p>
        ) : (
          history.map((conv) => (
            <HistoryItem
              key={conv.id}
              conv={conv}
              active={conv.id === activeId}
              onLoad={onLoad}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}

function HistoryItem({
  conv, active, onLoad, onDelete,
}: {
  conv: SavedConversation
  active: boolean
  onLoad: (conv: SavedConversation) => void
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const exchanges = Math.ceil(conv.messages.filter((m) => m.role === 'user').length)

  return (
    <div
      className={[
        'group relative flex items-start gap-0 border-l-2 mx-0 transition-colors cursor-pointer',
        active ? 'border-l-purple bg-purple/[0.06]' : 'border-l-transparent hover:bg-purple/[0.03]',
      ].join(' ')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onLoad(conv)}
    >
      <div className="flex-1 min-w-0 px-3 py-2.5">
        <p className={[
          'text-[10px] font-mono leading-snug truncate',
          active ? 'text-txt font-bold' : 'text-txt-2',
        ].join(' ')}>
          {conv.title}
        </p>
        <p className="text-[10px] text-txt-3 mt-0.5 font-mono">
          {relativeTime(conv.updatedAt)} · {exchanges} {exchanges === 1 ? 'msg' : 'msgs'}
        </p>
      </div>
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
          title="Delete conversation"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-txt-3 hover:text-red bg-transparent border-none cursor-pointer p-1 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function Analyst() {
  const [messages, setMessages] = useState<Message[]>([])
  const [history, setHistory] = useState<SavedConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [searching, setSearching] = useState(false)
  const [useWebSearch, setUseWebSearch] = useState(true)
  const [error, setError] = useState('')

  const { data: mispCtx } = useQuery({
    queryKey: ['misp-context-analyst'],
    queryFn: () => api.getMispContext('operational', '', 30),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Restore history on mount; pre-fill input if navigated from Prompt Library
  useEffect(() => {
    const saved = loadHistory()
    setHistory(saved)
    if (saved.length > 0) {
      setMessages(saved[0].messages)
      setActiveConvId(saved[0].id)
    }
    const pending = sessionStorage.getItem(PENDING_KEY)
    if (pending) {
      sessionStorage.removeItem(PENDING_KEY)
      setInput(pending)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px'
        }
      }, 50)
    }
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Save to history when streaming finishes
  const upsertHistory = useCallback((msgs: Message[], convId: string) => {
    const conv: SavedConversation = {
      id: convId,
      title: titleFromMessages(msgs),
      updatedAt: new Date().toISOString(),
      messages: msgs,
    }
    setHistory((prev) => {
      const filtered = prev.filter((c) => c.id !== convId)
      const updated = [conv, ...filtered].slice(0, MAX_HISTORY)
      persistHistory(updated)
      return updated
    })
  }, [])

  useEffect(() => {
    if (streaming || messages.length === 0 || !activeConvId) return
    upsertHistory(messages, activeConvId)
  }, [messages, streaming, activeConvId, upsertHistory])

  function resetTextarea() {
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  function handleNew() {
    abortRef.current?.abort()
    setMessages([])
    setActiveConvId(null)
    setInput('')
    setError('')
    setStreaming(false)
    setSearching(false)
    resetTextarea()
  }

  function handleLoad(conv: SavedConversation) {
    if (streaming) abortRef.current?.abort()
    setMessages(conv.messages)
    setActiveConvId(conv.id)
    setInput('')
    setError('')
    setStreaming(false)
    setSearching(false)
    resetTextarea()
  }

  function handleDelete(id: string) {
    setHistory((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      persistHistory(updated)
      return updated
    })
    if (id === activeConvId) {
      setMessages([])
      setActiveConvId(null)
    }
  }

  async function handleSend(text?: string) {
    const content = (text ?? input).trim()
    if (!content || streaming) return

    setInput('')
    setError('')
    resetTextarea()

    const convId = activeConvId ?? `conv-${Date.now()}`
    if (!activeConvId) setActiveConvId(convId)

    const userMsg: Message = { role: 'user', content }
    const assistantMsg: Message = { role: 'assistant', content: '' }
    const history = [...messages, userMsg]

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setStreaming(true)
    setSearching(false)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamChat(
        history,
        useWebSearch,
        (accumulated) => {
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: accumulated }
            return updated
          })
        },
        setSearching,
        controller.signal,
        mispCtx?.has_data ? mispCtx.context : null,
      )
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      toast(msg, 'error')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setStreaming(false)
      setSearching(false)
      abortRef.current = null
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-row h-full">

      {/* ── History sidebar ── */}
      <HistorySidebar
        history={history}
        activeId={activeConvId}
        onLoad={handleLoad}
        onDelete={handleDelete}
        onNew={handleNew}
      />

      {/* ── Chat panel ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">Analyst Chat</p>
            {messages.length > 0 && (
              <span className="text-[10px] text-txt-3 font-mono">
                {Math.ceil(messages.filter((m) => m.role === 'user').length)}{' '}
                {Math.ceil(messages.filter((m) => m.role === 'user').length) === 1 ? 'exchange' : 'exchanges'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mispCtx?.has_data && (
              <span
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-green/30 text-green"
                title={`MISP context injected — ${mispCtx.event_count} event${mispCtx.event_count !== 1 ? 's' : ''} from the last 30 days`}
              >
                <span className="w-[6px] h-[6px] rounded-full bg-green" />
                MISP
              </span>
            )}
            <button
              onClick={() => setUseWebSearch((v) => !v)}
              title={useWebSearch ? 'Web search on — click to disable' : 'Web search off — click to enable'}
              className={[
                'flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-colors bg-transparent cursor-pointer',
                useWebSearch
                  ? 'text-purple border-purple/40 hover:border-purple'
                  : 'text-txt-3 border-border hover:border-border2',
              ].join(' ')}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Web {useWebSearch ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-6 flex flex-col gap-6">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-6 py-12">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple to-cyan flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-txt mb-1">Analyst Chat</h2>
                <p className="text-[13px] text-txt-2 max-w-md">
                  Ask any threat intelligence or cybersecurity question.
                  {useWebSearch && ' Web search is enabled for current intelligence.'}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="text-left text-[11px] text-txt-2 bg-surface border border-border hover:border-border2 hover:text-txt rounded-lg px-4 py-2.5 transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1
            const isStreaming = streaming && isLast && msg.role === 'assistant'
            const isSearching = searching && isLast && msg.role === 'assistant'
            return msg.role === 'user' ? (
              <UserBubble key={i} content={msg.content} />
            ) : (
              <AssistantBubble key={i} content={msg.content} streaming={isStreaming} searching={isSearching} />
            )
          })}

          {error && (
            <div className="text-[11px] text-red font-mono bg-red/10 border border-red/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-border px-5 py-4">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about threat intelligence or cybersecurity…"
              rows={1}
              disabled={streaming}
              className="flex-1 bg-bg border border-border rounded-lg text-txt font-mono text-[13px] px-4 py-3 outline-none focus:border-purple transition-colors resize-none placeholder:text-txt-3 disabled:opacity-50 leading-relaxed"
              style={{ minHeight: '44px', maxHeight: '180px' }}
            />
            {streaming ? (
              <button
                onClick={handleStop}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-border hover:border-red hover:text-red text-txt-3 bg-transparent cursor-pointer transition-colors"
                title="Stop generating"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90"
                title="Send (Enter)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-[10px] text-txt-3 font-mono mt-2">
            Enter to send · Shift+Enter for newline{useWebSearch ? ' · Web search enabled' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
