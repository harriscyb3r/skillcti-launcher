import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { NewsFeed, NewsArticle, FeedCategory, OtxPulse } from '../lib/types'
import { usePagination } from '../lib/usePagination'
import Pagination from '../components/Pagination'
import EmptyState from '../components/EmptyState'
import IocChip from '../components/IocChip'

// ── constants ─────────────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  government: { bg: '#3b82f620', text: '#3b82f6', label: 'GOV' },
  news:       { bg: '#a855f720', text: '#a855f7', label: 'NEWS' },
  research:   { bg: '#06b6d420', text: '#06b6d4', label: 'RESEARCH' },
}

const CATEGORY_OPTIONS: FeedCategory[] = ['government', 'news', 'research']

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function CategoryBadge({ category }: { category: string }) {
  const s = CATEGORY_STYLE[category] ?? { bg: '#6b728020', text: '#6b7280', label: category.toUpperCase() }
  return (
    <span className="text-[11px] font-bold px-1.5 py-[2px] rounded flex-shrink-0" style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

// ── save to library button ────────────────────────────────────────────────────

function SaveArticleButton({ article }: { article: NewsArticle }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    if (state !== 'idle') return
    setState('saving')
    try {
      await api.createLibraryItem({
        type: 'report',
        title: article.title,
        summary: article.summary.slice(0, 300),
        source: article.feed_name,
        tags: [article.category, 'news'],
        content: { url: article.url, feed: article.feed_name, published: article.published },
      })
      setState('saved')
    } catch {
      setState('idle')
    }
  }
  return (
    <button
      onClick={handleSave}
      title={state === 'saved' ? 'Saved to Library' : 'Save to Library'}
      className="flex-shrink-0 bg-transparent border-none cursor-pointer p-0 transition-colors"
      style={{ color: state === 'saved' ? '#22c55e' : '#4b5563' }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill={state === 'saved' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}

// ── article row ───────────────────────────────────────────────────────────────

function ArticleRow({ article, onRead }: { article: NewsArticle; onRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault()
    if (!article.read) onRead(article.id)
    window.open(article.url, '_blank', 'noopener,noreferrer')
  }

  function handleExpand() {
    if (!article.read) onRead(article.id)
    setExpanded((v) => !v)
  }

  return (
    <div
      className={[
        'border-b border-border/50 transition-colors',
        !article.read ? 'bg-purple/[0.02]' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 px-5 py-3 group">
        {/* Unread dot */}
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors" style={{ background: article.read ? 'transparent' : '#a855f7' }} />

        {/* Category badge */}
        <CategoryBadge category={article.category} />

        {/* Title */}
        <div className="flex-1 min-w-0">
          <a
            href={article.url}
            onClick={handleOpen}
            className="text-[11px] font-bold text-txt truncate block leading-snug"
          >
            {article.title}
          </a>
          <span className="text-[10px] text-txt-3 font-mono">{article.feed_name}</span>
        </div>

        {/* Time */}
        <span className="text-[10px] text-txt-3 font-mono flex-shrink-0">{timeAgo(article.published || article.fetched_at)}</span>

        {/* Save */}
        <SaveArticleButton article={article} />

        {/* Expand chevron */}
        {article.summary && (
          <button
            onClick={handleExpand}
            className="flex-shrink-0 text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer p-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>

      {expanded && article.summary && (
        <div className="px-5 pb-4 ml-10">
          <p className="text-[11px] text-txt-2 leading-relaxed max-w-3xl">{article.summary}</p>
        </div>
      )}
    </div>
  )
}

// ── feed row in left panel ────────────────────────────────────────────────────

function FeedRow({
  feed,
  selected,
  onClick,
  onToggle,
  onDelete,
}: {
  feed: NewsFeed
  selected: boolean
  onClick: () => void
  onToggle: (enabled: boolean) => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      className={[
        'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
        selected ? 'bg-purple/[0.08]' : 'hover:bg-bg/60',
      ].join(' ')}
    >
      <button onClick={onClick} className="flex-1 flex items-center gap-2 min-w-0 bg-transparent border-none cursor-pointer p-0 text-left">
        {/* Enabled indicator */}
        <div
          className="w-1 h-4 rounded-full flex-shrink-0 transition-colors"
          style={{ background: feed.enabled ? '#a855f7' : '#374151' }}
        />
        <span className={['text-[11px] font-bold truncate flex-1', selected ? 'text-purple' : 'text-txt-2'].join(' ')}>
          {feed.name}
        </span>
        {feed.unread_count > 0 && (
          <span className="text-[11px] font-bold px-1.5 py-[2px] rounded-full bg-purple/15 text-purple leading-none flex-shrink-0">
            {feed.unread_count}
          </span>
        )}
        {feed.fetch_error && (
          <span className="text-[11px] text-red flex-shrink-0" title={feed.fetch_error}>⚠</span>
        )}
      </button>

      {/* Actions (visible on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(!feed.enabled) }}
          title={feed.enabled ? 'Disable feed' : 'Enable feed'}
          className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer p-0.5"
        >
          {feed.enabled ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64A9 9 0 0 1 20.77 15"/><path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>
          )}
        </button>
        {!confirmDelete ? (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
            className="text-[11px] text-txt-3 hover:text-red bg-transparent border-none cursor-pointer p-0.5"
            title="Remove feed"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="text-[11px] font-bold text-red bg-transparent border-none cursor-pointer">✓</button>
            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }} className="text-[11px] text-txt-3 bg-transparent border-none cursor-pointer">✕</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── add feed form ─────────────────────────────────────────────────────────────

function AddFeedForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState<FeedCategory>('news')

  const addMut = useMutation({
    mutationFn: () => api.addNewsFeed(name.trim(), url.trim(), category),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['news-feeds'] })
      onDone()
    },
  })

  const canSubmit = name.trim().length > 0 && url.trim().startsWith('http')

  return (
    <div className="p-3 border border-border rounded-lg bg-bg mt-2 flex flex-col gap-2">
      <p className="text-[11px] font-bold tracking-[0.1em] text-txt-3 uppercase">Add RSS Feed</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Feed name"
        className="w-full bg-surface border border-border rounded text-txt text-[11px] px-2 py-1.5 outline-none focus:border-purple transition-colors"
        autoFocus
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/feed.xml"
        className="w-full bg-surface border border-border rounded text-txt font-mono text-[10px] px-2 py-1.5 outline-none focus:border-purple transition-colors"
      />
      <div className="flex gap-1">
        {CATEGORY_OPTIONS.map((c) => {
          const s = CATEGORY_STYLE[c]
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="px-2 py-1 text-[11px] font-bold rounded border transition-all cursor-pointer"
              style={{
                color: s.text,
                borderColor: s.text,
                background: category === c ? s.bg : 'transparent',
                opacity: category === c ? 1 : 0.5,
              }}
            >
              {c}
            </button>
          )
        })}
      </div>
      {addMut.error && (
        <p className="text-[10px] text-red font-mono">{(addMut.error as Error).message}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => addMut.mutate()}
          disabled={!canSubmit || addMut.isPending}
          className="flex-1 py-1.5 text-[11px] font-bold rounded bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90"
        >
          {addMut.isPending ? 'Adding…' : 'Add Feed'}
        </button>
        <button
          onClick={onDone}
          className="px-3 py-1.5 text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

// ── TLP colour ────────────────────────────────────────────────────────────────

const TLP_STYLE: Record<string, { bg: string; text: string }> = {
  red:    { bg: '#ef444420', text: '#ef4444' },
  amber:  { bg: '#f59e0b20', text: '#f59e0b' },
  green:  { bg: '#22c55e20', text: '#22c55e' },
  white:  { bg: '#9ca3af20', text: '#9ca3af' },
}

function TlpBadge({ tlp }: { tlp: string }) {
  const s = TLP_STYLE[tlp?.toLowerCase()] ?? TLP_STYLE.white
  return (
    <span className="text-[10px] font-bold px-1.5 py-[2px] rounded font-mono flex-shrink-0"
      style={{ background: s.bg, color: s.text }}>
      TLP:{tlp?.toUpperCase() ?? 'WHITE'}
    </span>
  )
}

// ── OTX Pulse card ────────────────────────────────────────────────────────────

function OtxPulseCard({ pulse }: { pulse: OtxPulse }) {
  const [expanded, setExpanded] = useState(false)
  const url = `https://otx.alienvault.com/pulse/${pulse.id}`

  return (
    <div className="border-b border-border/50 px-5 py-3 hover:bg-surface/60 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <TlpBadge tlp={pulse.tlp} />
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="text-[12px] font-bold text-txt hover:text-purple transition-colors leading-snug truncate">
              {pulse.name}
            </a>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-txt-3 font-mono">
            <span>{pulse.author}</span>
            <span>·</span>
            <span>{timeAgo(pulse.created)}</span>
            <span>·</span>
            <span>{pulse.ioc_count} IOCs</span>
            {pulse.malware_families.length > 0 && (
              <><span>·</span><span className="text-amber">{pulse.malware_families.join(', ')}</span></>
            )}
          </div>
        </div>
        <button onClick={() => setExpanded(v => !v)}
          className="text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer p-1 flex-shrink-0 transition-colors">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/50 flex flex-col gap-2">
          {pulse.description && (
            <p className="text-[11px] text-txt-2 leading-relaxed">{pulse.description}</p>
          )}
          <div className="flex flex-wrap gap-3 text-[11px]">
            {pulse.targeted_countries.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-txt-3 uppercase tracking-wider">Targets:</span>
                <span className="text-txt-2">{pulse.targeted_countries.join(', ')}</span>
              </div>
            )}
            {pulse.attack_ids.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-txt-3 uppercase tracking-wider">ATT&CK:</span>
                <span className="text-txt-2 font-mono">{pulse.attack_ids.join(', ')}</span>
              </div>
            )}
          </div>
          {pulse.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pulse.tags.map(t => (
                <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Abuse.ch view ────────────────────────────────────────────────────────────

function AbuseChView() {
  const qc = useQueryClient()

  const mbQ  = useQuery({ queryKey: ['abuse-mb'],  queryFn: () => api.getMalwareBazaar(25),    staleTime: 0, retry: false })
  const uhQ  = useQuery({ queryKey: ['abuse-uh'],  queryFn: () => api.getUrlHaus(25),          staleTime: 0, retry: false })
  const tfQ  = useQuery({ queryKey: ['abuse-tf'],  queryFn: () => api.getThreatFoxFeed(1, 30), staleTime: 0, retry: false })

  const refreshAll = useMutation({
    mutationFn: async () => {
      const [mb, uh, tf] = await Promise.all([
        api.getMalwareBazaar(25, true),
        api.getUrlHaus(25, true),
        api.getThreatFoxFeed(1, 30, true),
      ])
      return { mb, uh, tf }
    },
    onSuccess: ({ mb, uh, tf }) => {
      qc.setQueryData(['abuse-mb'], mb)
      qc.setQueryData(['abuse-uh'], uh)
      qc.setQueryData(['abuse-tf'], tf)
    },
  })

  const isLoading = mbQ.isLoading || uhQ.isLoading || tfQ.isLoading

  const IOC_TYPE_STYLE: Record<string, { bg: string; text: string }> = {
    'ip:port':   { bg: '#3b82f620', text: '#3b82f6' },
    'domain':    { bg: '#06b6d420', text: '#06b6d4' },
    'url':       { bg: '#f9731620', text: '#f97316' },
    'md5_hash':  { bg: '#a855f720', text: '#a855f7' },
    'sha256_hash': { bg: '#a855f720', text: '#a855f7' },
    'sha1_hash': { bg: '#a855f720', text: '#a855f7' },
  }

  const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
    'online':  { bg: '#ef444420', text: '#ef4444' },
    'offline': { bg: '#6b728020', text: '#6b7280' },
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[11px] text-txt-2">
          <span><span className="font-bold text-txt">{mbQ.data?.samples?.length ?? 0}</span> malware samples</span>
          <span className="text-border2">·</span>
          <span><span className="font-bold text-txt">{uhQ.data?.urls?.length ?? 0}</span> malicious URLs</span>
          <span className="text-border2">·</span>
          <span><span className="font-bold text-txt">{tfQ.data?.iocs?.length ?? 0}</span> IOCs</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshAll.mutate()}
            disabled={refreshAll.isPending || isLoading}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-border hover:border-border2 text-txt-3 hover:text-txt-2 bg-transparent cursor-pointer disabled:opacity-40 transition-colors font-mono"
          >
            {refreshAll.isPending ? (
              <span className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin" />
            ) : (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            )}
            {refreshAll.isPending ? 'Refreshing…' : 'Refresh'}
          </button>
          <a href="https://abuse.ch" target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-bold text-txt-3 hover:text-txt-2 transition-colors font-mono no-underline">
            abuse.ch →
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* MalwareBazaar */}
        <div className="border-b border-border">
          <div className="px-5 py-2 bg-surface/60 flex items-center gap-2">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red flex-shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="text-[11px] font-bold tracking-[0.15em] text-txt-2 uppercase">MalwareBazaar</span>
            <span className="text-[10px] text-txt-3 font-mono ml-auto">recent samples</span>
          </div>
          {mbQ.isLoading ? (
            <div className="px-5 py-4 text-[11px] text-txt-3 font-mono animate-pulse">Loading…</div>
          ) : mbQ.data?.status === 'error' ? (
            <div className="px-5 py-4 text-[11px] text-red font-mono">{mbQ.data.detail}</div>
          ) : (mbQ.data?.samples ?? []).map((s) => (
            <div key={s.sha256} className="flex items-center gap-3 px-5 py-2.5 border-b border-border/40 hover:bg-surface/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {s.signature && (
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-red/10 text-red border border-red/20 flex-shrink-0">
                      {s.signature}
                    </span>
                  )}
                  {s.file_type && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3 flex-shrink-0">
                      {s.file_type}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-txt-3 truncate">
                    {s.file_name || s.sha256.slice(0, 16) + '…'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <IocChip value={s.sha256} type="hash" />
                  {s.md5 && <IocChip value={s.md5} type="hash" />}
                  <span className="text-[10px] text-txt-3 font-mono">
                    {[s.origin_country, s.file_size > 0 ? (s.file_size / 1024).toFixed(1) + ' KB' : null].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {s.tags.slice(0, 3).map((t: string) => (
                  <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3">{t}</span>
                ))}
                <span className="text-[10px] text-txt-3 font-mono whitespace-nowrap">{timeAgo(s.first_seen)}</span>
                <a href={`https://bazaar.abuse.ch/sample/${s.sha256}/`} target="_blank" rel="noopener noreferrer"
                  className="text-txt-3 hover:text-txt-2 transition-colors" title="View on MalwareBazaar">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* URLhaus */}
        <div className="border-b border-border">
          <div className="px-5 py-2 bg-surface/60 flex items-center gap-2">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber flex-shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="text-[11px] font-bold tracking-[0.15em] text-txt-2 uppercase">URLhaus</span>
            <span className="text-[10px] text-txt-3 font-mono ml-auto">malicious URLs</span>
          </div>
          {uhQ.isLoading ? (
            <div className="px-5 py-4 text-[11px] text-txt-3 font-mono animate-pulse">Loading…</div>
          ) : uhQ.data?.status === 'error' ? (
            <div className="px-5 py-4 text-[11px] text-red font-mono">{uhQ.data.detail}</div>
          ) : (uhQ.data?.urls ?? []).map((u) => {
            const st = STATUS_STYLE[u.url_status] ?? STATUS_STYLE.offline
            return (
              <div key={u.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-border/40 hover:bg-surface/40 transition-colors">
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border flex-shrink-0"
                  style={{ background: st.bg, color: st.text, borderColor: st.text + '40' }}>
                  {u.url_status.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <IocChip value={u.url} type="url" />
                    {u.host && (() => { try { return u.host !== new URL(u.url).hostname } catch { return true } })() && (
                      <IocChip value={u.host} type="domain" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-txt-3 font-mono mt-0.5">
                    {u.threat && <span className="text-amber">{u.threat}</span>}
                    {u.country_code && <span>{u.country_code}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {u.tags.slice(0, 3).map((t: string) => (
                    <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3">{t}</span>
                  ))}
                  <span className="text-[10px] text-txt-3 font-mono whitespace-nowrap">{timeAgo(u.date_added)}</span>
                  <a href={`https://urlhaus.abuse.ch/url/${u.id}/`} target="_blank" rel="noopener noreferrer"
                    className="text-txt-3 hover:text-txt-2 transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        {/* ThreatFox */}
        <div>
          <div className="px-5 py-2 bg-surface/60 flex items-center gap-2">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan flex-shrink-0">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <span className="text-[11px] font-bold tracking-[0.15em] text-txt-2 uppercase">ThreatFox</span>
            <span className="text-[10px] text-txt-3 font-mono ml-auto">recent IOCs · last 24 hours</span>
          </div>
          {tfQ.isLoading ? (
            <div className="px-5 py-4 text-[11px] text-txt-3 font-mono animate-pulse">Loading…</div>
          ) : tfQ.data?.status === 'error' ? (
            <div className="px-5 py-4 text-[11px] text-red font-mono">{tfQ.data.detail}</div>
          ) : (tfQ.data?.iocs ?? []).length === 0 ? (
            <div className="px-5 py-4 text-[11px] text-txt-3 font-mono">No IOCs in the last 24 hours.</div>
          ) : (tfQ.data?.iocs ?? []).map((i) => {
            const ts = IOC_TYPE_STYLE[i.ioc_type] ?? { bg: '#6b728020', text: '#6b7280' }
            const conf = i.confidence ?? 0
            const confColor = conf >= 75 ? '#ef4444' : conf >= 50 ? '#f59e0b' : '#22c55e'
            return (
              <div key={i.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-border/40 hover:bg-surface/40 transition-colors">
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <IocChip value={i.ioc} />
                  <div className="flex items-center gap-3 text-[10px] text-txt-3 font-mono">
                    {i.malware && <span className="text-amber font-bold">{i.malware}</span>}
                    {i.malware_alias && <span>{i.malware_alias}</span>}
                    {i.threat_type && <span>{i.threat_type}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] font-bold font-mono" style={{ color: confColor }}>
                    {conf}%
                  </span>
                  {i.tags.slice(0, 2).map((t: string) => (
                    <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3">{t}</span>
                  ))}
                  <span className="text-[10px] text-txt-3 font-mono whitespace-nowrap">{timeAgo(i.first_seen)}</span>
                  <a href={`https://threatfox.abuse.ch/ioc/${i.id}/`} target="_blank" rel="noopener noreferrer"
                    className="text-txt-3 hover:text-txt-2 transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}

// ── OTX Pulses view ───────────────────────────────────────────────────────────

function OtxPulsesView() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['otx-feed'],
    queryFn: () => api.getOtxFeed(100),
    staleTime: 0,
    retry: false,
  })

  const refresh = useMutation({
    mutationFn: () => api.getOtxFeed(100, true),
    onSuccess: (fresh) => qc.setQueryData(['otx-feed'], fresh),
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] text-txt-3 font-mono">Loading OTX pulses…</span>
        </div>
      </div>
    )
  }

  if (data?.status === 'no_key' || data?.status === 'bad_key') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
          title={data.status === 'bad_key' ? 'Invalid OTX API key' : 'OTX not configured'}
          description="Add your AlienVault OTX API key in Settings to see threat pulses."
          to="/settings"
          actionLabel="Go to Settings"
        />
      </div>
    )
  }

  if (data?.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
          title="Failed to load OTX pulses"
          description={data.detail ?? 'Check your API key and network connection.'}
        />
        <button onClick={() => refresh.mutate()} disabled={refresh.isPending}
          className="text-[10px] font-bold font-mono text-txt-3 hover:text-txt bg-transparent border-none cursor-pointer transition-colors">
          Try again →
        </button>
      </div>
    )
  }

  const pulses = data?.pulses ?? []
  const rawStatus = data?.status

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-txt-2">
            <span className="font-bold text-txt">{pulses.length}</span> pulses
          </span>
          {rawStatus && rawStatus !== 'ok' && (
            <span className="text-[10px] font-mono text-amber bg-amber/10 px-2 py-0.5 rounded border border-amber/20">
              status: {rawStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-border hover:border-border2 text-txt-3 hover:text-txt-2 bg-transparent cursor-pointer disabled:opacity-40 transition-colors font-mono"
          >
            {refresh.isPending ? (
              <span className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin" />
            ) : (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            )}
            {refresh.isPending ? 'Refreshing…' : 'Refresh'}
          </button>
          <a href="https://otx.alienvault.com/browse/pulses" target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-bold text-txt-3 hover:text-txt-2 transition-colors font-mono no-underline">
            Open OTX →
          </a>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {pulses.length === 0 ? (
          <EmptyState
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/></svg>}
            title="No pulses returned"
            description="Backend restarted? Try clicking Refresh, or check the backend logs."
            onAction={() => refresh.mutate()}
            actionLabel="Refresh now"
          />
        ) : (
          pulses.map(p => <OtxPulseCard key={p.id} pulse={p} />)
        )}
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Feeds() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<'news' | 'otx' | 'abuse'>('news')
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [search, setSearch] = useState(searchParams.get('q') ?? '')

  const feedsQuery = useQuery({
    queryKey: ['news-feeds'],
    queryFn: api.getNewsFeeds,
    refetchInterval: 60_000,
  })

  const articlesQuery = useQuery({
    queryKey: ['news-articles', selectedFeedId, unreadOnly],
    queryFn: () => api.getNewsArticles({ feed_id: selectedFeedId ?? undefined, unread_only: unreadOnly, limit: 80 }),
    refetchInterval: 60_000,
  })

  const feeds = feedsQuery.data?.feeds ?? []
  const rawArticles = articlesQuery.data?.articles ?? []
  const totalUnread = articlesQuery.data?.unread_count ?? 0

  const articles = search.trim()
    ? rawArticles.filter((a) =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.feed_name.toLowerCase().includes(search.toLowerCase())
      )
    : rawArticles

  const pg = usePagination(articles, 30)

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => api.toggleNewsFeed(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['news-feeds'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteNewsFeed(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['news-feeds'] })
      if (selectedFeedId === deleteMut.variables) setSelectedFeedId(null)
    },
  })

  const markAllMut = useMutation({
    mutationFn: () => api.markAllNewsRead(selectedFeedId ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['news-articles'] })
      qc.invalidateQueries({ queryKey: ['news-feeds'] })
      qc.invalidateQueries({ queryKey: ['news-unread-count'] })
    },
  })

  const refreshMut = useMutation({
    mutationFn: api.refreshNewsFeeds,
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['news-articles'] })
        qc.invalidateQueries({ queryKey: ['news-feeds'] })
        qc.invalidateQueries({ queryKey: ['news-unread-count'] })
      }, 3000)
    },
  })

  function handleRead(articleId: string) {
    api.markArticleRead(articleId).then(() => {
      qc.invalidateQueries({ queryKey: ['news-articles'] })
      qc.invalidateQueries({ queryKey: ['news-feeds'] })
      qc.invalidateQueries({ queryKey: ['news-unread-count'] })
    })
  }

  // Group feeds by category for display
  const grouped = feeds.reduce<Record<string, NewsFeed[]>>((acc, f) => {
    const g = f.category || 'news'
    if (!acc[g]) acc[g] = []
    acc[g].push(f)
    return acc
  }, {})

  const allUnread = feeds.reduce((s, f) => s + f.unread_count, 0)

  const tabCls = (active: boolean) =>
    `px-4 py-3 text-[10px] font-bold tracking-[0.12em] uppercase border-b-2 transition-colors cursor-pointer bg-transparent border-x-0 border-t-0 font-mono ${
      active
        ? 'text-purple border-b-purple'
        : 'text-txt-3 border-b-transparent hover:text-txt-2'
    }`

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Tab bar */}
      <div className="flex-shrink-0 border-b border-border bg-surface/50 flex items-center">
        <button className={tabCls(view === 'news')} onClick={() => setView('news')}>
          News Feeds
          {totalUnread > 0 && (
            <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-purple/20 text-purple leading-none">
              {totalUnread}
            </span>
          )}
        </button>
        <button className={tabCls(view === 'otx')} onClick={() => setView('otx')}>
          OTX Pulses
        </button>
        <button className={tabCls(view === 'abuse')} onClick={() => setView('abuse')}>
          Abuse.ch
        </button>
      </div>

      {view === 'otx' ? <OtxPulsesView /> : view === 'abuse' ? <AbuseChView /> : (
      <div className="flex flex-1 overflow-hidden">

      {/* Left panel — feed list */}
      <div className="w-[240px] flex-shrink-0 border-r border-border flex flex-col h-full bg-surface/50">
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-bold text-txt">News Feeds</span>
            <button
              onClick={() => refreshMut.mutate()}
              disabled={refreshMut.isPending}
              title="Refresh all feeds"
              className="text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer p-0.5 transition-colors disabled:opacity-40"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={refreshMut.isPending ? 'animate-spin' : ''}>
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>

          {/* All feeds entry */}
          <button
            onClick={() => { setSelectedFeedId(null); setSearch('') }}
            className={[
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors bg-transparent border-none cursor-pointer',
              selectedFeedId === null ? 'bg-purple/[0.08]' : 'hover:bg-bg/60',
            ].join(' ')}
          >
            <div className="flex-1 min-w-0">
              <span className={['text-[11px] font-bold', selectedFeedId === null ? 'text-purple' : 'text-txt-2'].join(' ')}>
                All Feeds
              </span>
            </div>
            {allUnread > 0 && (
              <span className="text-[11px] font-bold px-1.5 py-[2px] rounded-full bg-purple/15 text-purple leading-none">
                {allUnread}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {(['government', 'news', 'research'] as FeedCategory[]).map((cat) => {
            const catFeeds = grouped[cat]
            if (!catFeeds?.length) return null
            const s = CATEGORY_STYLE[cat]
            return (
              <div key={cat} className="mb-4">
                <p className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1 px-3" style={{ color: s.text }}>
                  {cat}
                </p>
                {catFeeds.map((feed) => (
                  <FeedRow
                    key={feed.id}
                    feed={feed}
                    selected={selectedFeedId === feed.id}
                    onClick={() => { setSelectedFeedId(feed.id); setSearch('') }}
                    onToggle={(enabled) => toggleMut.mutate({ id: feed.id, enabled })}
                    onDelete={() => deleteMut.mutate(feed.id)}
                  />
                ))}
              </div>
            )
          })}

          {/* Custom feeds (category not in standard list) */}
          {Object.entries(grouped)
            .filter(([cat]) => !['government', 'news', 'research'].includes(cat))
            .map(([cat, catFeeds]) => (
              <div key={cat} className="mb-4">
                <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-txt-3 mb-1 px-3">{cat}</p>
                {catFeeds.map((feed) => (
                  <FeedRow
                    key={feed.id}
                    feed={feed}
                    selected={selectedFeedId === feed.id}
                    onClick={() => { setSelectedFeedId(feed.id); setSearch('') }}
                    onToggle={(enabled) => toggleMut.mutate({ id: feed.id, enabled })}
                    onDelete={() => deleteMut.mutate(feed.id)}
                  />
                ))}
              </div>
            ))
          }

          {showAddForm ? (
            <AddFeedForm onDone={() => setShowAddForm(false)} />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer transition-colors"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Feed
            </button>
          )}
        </div>
      </div>

      {/* Right panel — articles */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-bold text-txt">
              {selectedFeedId != null
                ? (feeds.find((f) => f.id === selectedFeedId)?.name ?? 'Feed')
                : 'All Articles'}
            </span>
            {totalUnread > 0 && (
              <span className="ml-2 text-[11px] font-bold px-1.5 py-[2px] rounded-full bg-purple/15 text-purple">
                {totalUnread} unread
              </span>
            )}
          </div>

          {/* Search input */}
          <div className="flex items-center gap-1.5 bg-bg border border-border rounded-lg px-2.5 py-1.5 min-w-[180px]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-txt-3 flex-shrink-0">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSearchParams({}, { replace: true }) }}
              placeholder="Filter articles…"
              className="bg-transparent border-none outline-none text-[11px] text-txt placeholder:text-txt-3 w-full"
              autoComplete="off"
              spellCheck={false}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setSearchParams({}, { replace: true }) }}
                className="text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer text-[12px] leading-none flex-shrink-0"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <div
                onClick={() => setUnreadOnly((v) => !v)}
                className={[
                  'w-7 h-4 rounded-full transition-colors cursor-pointer relative',
                  unreadOnly ? 'bg-purple' : 'bg-border',
                ].join(' ')}
              >
                <div className={[
                  'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform',
                  unreadOnly ? 'translate-x-3.5' : 'translate-x-0.5',
                ].join(' ')} />
              </div>
              <span className="text-[11px] text-txt-3">Unread only</span>
            </label>

            {totalUnread > 0 && (
              <button
                onClick={() => markAllMut.mutate()}
                disabled={markAllMut.isPending}
                className="text-[11px] text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer disabled:opacity-40"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Article list */}
        <div className="flex-1 overflow-y-auto">
          {articlesQuery.isLoading && (
            <div className="flex items-center justify-center py-12 gap-2 text-txt-3 text-[11px]">
              <div className="w-3 h-3 border border-purple border-t-transparent rounded-full animate-spin" />
              Loading articles…
            </div>
          )}

          {!articlesQuery.isLoading && rawArticles.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="8" y1="8" x2="16" y2="8" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="8" y1="16" x2="12" y2="16" />
              </svg>
              <div>
                <p className="text-[13px] font-semibold text-txt-2">
                  {unreadOnly ? 'No unread articles' : 'No articles yet'}
                </p>
                <p className="text-[11px] text-txt-3 mt-1">
                  {unreadOnly
                    ? 'Toggle "Unread only" off to see all articles'
                    : 'Articles will appear here after the first feed refresh'}
                </p>
              </div>
              {!unreadOnly && (
                <button
                  onClick={() => refreshMut.mutate()}
                  disabled={refreshMut.isPending}
                  className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-purple/10 text-purple hover:bg-purple/20 transition-colors border border-purple/20 disabled:opacity-50 cursor-pointer"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={refreshMut.isPending ? 'animate-spin' : ''}>
                    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  {refreshMut.isPending ? 'Refreshing…' : 'Refresh feeds'}
                </button>
              )}
            </div>
          )}

          {!articlesQuery.isLoading && rawArticles.length > 0 && articles.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center px-4">
              <p className="text-[13px] font-semibold text-txt-2">No articles match</p>
              <p className="text-[11px] text-txt-3">
                No results for <span className="font-mono text-txt-2">"{search}"</span>
              </p>
            </div>
          )}

          {pg.paged.map((article) => (
            <ArticleRow key={article.id} article={article} onRead={handleRead} />
          ))}
          <div className="px-5 py-3">
            <Pagination
              page={pg.page}
              totalPages={pg.totalPages}
              total={pg.total}
              from={pg.from}
              to={pg.to}
              hasPrev={pg.hasPrev}
              hasNext={pg.hasNext}
              onPage={pg.setPage}
            />
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  )
}
