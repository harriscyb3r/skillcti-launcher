import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { LibraryItem, LibraryItemType, Verdict, UpdateLibraryItem } from '../lib/types'

// ── constants ─────────────────────────────────────────────────────────────────

const TYPE_TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'IOC', value: 'ioc' },
  { label: 'Actor', value: 'actor' },
  { label: 'Note', value: 'note' },
  { label: 'Report', value: 'report' },
]

const TLP_OPTIONS = ['TLP:WHITE', 'TLP:GREEN', 'TLP:AMBER', 'TLP:RED']

const TLP_COLOR: Record<string, string> = {
  'TLP:WHITE': '#e5e7eb',
  'TLP:GREEN': '#22c55e',
  'TLP:AMBER': '#f59e0b',
  'TLP:RED':   '#ef4444',
}

const VERDICT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  malicious:  { bg: '#ef444420', text: '#ef4444', label: 'MALICIOUS' },
  suspicious: { bg: '#f59e0b20', text: '#f59e0b', label: 'SUSPICIOUS' },
  clean:      { bg: '#22c55e20', text: '#22c55e', label: 'CLEAN' },
  unknown:    { bg: '#6b728020', text: '#6b7280', label: 'UNKNOWN' },
}

const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  ioc:    { bg: '#3b82f620', text: '#3b82f6' },
  actor:  { bg: '#a855f720', text: '#a855f7' },
  note:   { bg: '#06b6d420', text: '#06b6d4' },
  report: { bg: '#f9731620', text: '#f97316' },
}

const TAG_PALETTE = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981',
  '#f97316', '#ef4444', '#6366f1', '#ec4899', '#14b8a6',
]

function tagColor(tag: string): string {
  let n = 0
  for (let i = 0; i < tag.length; i++) n = (n * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_PALETTE[n % TAG_PALETTE.length]
}

// ── small components ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_STYLE[type] ?? { bg: '#6b728020', text: '#6b7280' }
  return (
    <span className="text-[8px] font-bold px-1.5 py-[2px] rounded" style={{ background: s.bg, color: s.text }}>
      {type.toUpperCase()}
    </span>
  )
}

function TlpBadge({ tlp }: { tlp: string }) {
  const color = TLP_COLOR[tlp] ?? '#6b7280'
  return (
    <span className="text-[8px] font-bold px-1.5 py-[2px] rounded font-mono" style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}>
      {tlp}
    </span>
  )
}

function TagPill({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const color = tagColor(tag)
  return (
    <span
      className="inline-flex items-center gap-1 text-[8px] font-bold px-2 py-[2px] rounded leading-none"
      style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}
    >
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="bg-transparent border-none cursor-pointer p-0 leading-none text-current opacity-60 hover:opacity-100">×</button>
      )}
    </span>
  )
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── item list row ─────────────────────────────────────────────────────────────

function ItemRow({ item, selected, onClick }: { item: LibraryItem; selected: boolean; onClick: () => void }) {
  const vs = item.verdict ? VERDICT_STYLE[item.verdict] : null
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3 border-b border-border/50 transition-colors cursor-pointer bg-transparent border-none',
        selected ? 'bg-purple/[0.08]' : 'hover:bg-bg/60',
      ].join(' ')}
    >
      <div className="flex items-start gap-2 mb-1">
        <TypeBadge type={item.type} />
        {vs && (
          <span className="text-[8px] font-bold px-1.5 py-[2px] rounded" style={{ background: vs.bg, color: vs.text }}>
            {vs.label}
          </span>
        )}
      </div>
      <p className="text-[11px] font-bold text-txt truncate leading-tight mb-0.5">{item.title || '(untitled)'}</p>
      {item.summary && (
        <p className="text-[9px] text-txt-3 truncate leading-snug">{item.summary}</p>
      )}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {item.tags.slice(0, 3).map((t) => (
          <span key={t} className="text-[10px] font-bold" style={{ color: tagColor(t) }}>#{t}</span>
        ))}
        {item.tags.length > 3 && <span className="text-[10px] text-txt-3">+{item.tags.length - 3}</span>}
        <span className="text-[10px] text-txt-3 ml-auto">{timeAgo(item.updated_at)}</span>
      </div>
    </button>
  )
}

// ── new note form ─────────────────────────────────────────────────────────────

function NewNoteForm({ onSave, onCancel }: { onSave: (item: LibraryItem) => void; onCancel: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tlp, setTlp] = useState('TLP:AMBER')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  const createMut = useMutation({
    mutationFn: () => api.createLibraryItem({ type: 'note', title: title.trim() || 'New Note', notes, tags, tlp }),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: ['library'] })
      onSave(item)
    },
  })

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  return (
    <div className="flex flex-col gap-4 h-full p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-txt">New Note</h2>
        <button onClick={onCancel} className="text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer text-[11px]">Cancel</button>
      </div>

      <div>
        <label className="text-[9px] font-bold tracking-[0.15em] text-txt-3 uppercase block mb-1">Title</label>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. APT29 C2 Infrastructure"
          className="w-full bg-bg border border-border rounded-lg text-txt text-[13px] px-3 py-2 outline-none focus:border-purple transition-colors"
        />
      </div>

      <div>
        <label className="text-[9px] font-bold tracking-[0.15em] text-txt-3 uppercase block mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Write your analysis, observations, or context here..."
          rows={10}
          className="w-full bg-bg border border-border rounded-lg text-txt text-[13px] px-3 py-2 outline-none focus:border-purple transition-colors resize-none font-mono leading-relaxed"
        />
      </div>

      <div>
        <label className="text-[9px] font-bold tracking-[0.15em] text-txt-3 uppercase block mb-1">Tags</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t) => <TagPill key={t} tag={t} onRemove={() => setTags(tags.filter((x) => x !== t))} />)}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder="Add tag, press Enter"
            className="flex-1 bg-bg border border-border rounded-lg text-txt text-[11px] px-3 py-1.5 outline-none focus:border-purple transition-colors"
          />
          <button onClick={addTag} className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-border text-txt-3 bg-transparent hover:border-purple cursor-pointer transition-colors">Add</button>
        </div>
      </div>

      <div>
        <label className="text-[9px] font-bold tracking-[0.15em] text-txt-3 uppercase block mb-1">TLP</label>
        <div className="flex gap-2">
          {TLP_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTlp(t)}
              className={['px-2 py-1 text-[8px] font-bold rounded border transition-all cursor-pointer', tlp === t ? 'opacity-100' : 'opacity-40'].join(' ')}
              style={{ color: TLP_COLOR[t], borderColor: TLP_COLOR[t], background: tlp === t ? `${TLP_COLOR[t]}20` : 'transparent' }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => createMut.mutate()}
        disabled={createMut.isPending}
        className="px-5 py-2.5 text-[11px] font-bold tracking-[0.1em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90"
      >
        {createMut.isPending ? 'Saving…' : 'Save Note'}
      </button>
    </div>
  )
}

// ── item detail / edit panel ──────────────────────────────────────────────────

function ItemDetail({ item, onDeleted }: { item: LibraryItem; onDeleted: () => void }) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState(item.notes)
  const [tags, setTags] = useState<string[]>(item.tags)
  const [tagInput, setTagInput] = useState('')
  const [tlp, setTlp] = useState(item.tlp)
  const [dirty, setDirty] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    setNotes(item.notes)
    setTags(item.tags)
    setTlp(item.tlp)
    setDirty(false)
  }, [item.id])

  const saveMut = useMutation({
    mutationFn: (updates: UpdateLibraryItem) => api.updateLibraryItem(item.id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library'] })
      setDirty(false)
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => api.deleteLibraryItem(item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library'] })
      onDeleted()
    },
  })

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !tags.includes(t)) {
      const next = [...tags, t]
      setTags(next)
      setDirty(true)
    }
    setTagInput('')
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t))
    setDirty(true)
  }

  function handleSave() {
    saveMut.mutate({ notes, tags, tlp })
  }

  const vs = item.verdict ? VERDICT_STYLE[item.verdict] : null
  const contentKeys = Object.keys(item.content ?? {})

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-start gap-2 mb-2 flex-wrap">
          <TypeBadge type={item.type} />
          {vs && (
            <span className="text-[8px] font-bold px-1.5 py-[2px] rounded" style={{ background: vs.bg, color: vs.text }}>
              {vs.label}
            </span>
          )}
          <TlpBadge tlp={tlp} />
          {item.source && (
            <span className="text-[8px] font-mono text-txt-3">via {item.source}</span>
          )}
        </div>
        <h2 className="text-[15px] font-semibold text-txt leading-tight mb-1">{item.title}</h2>
        {item.summary && <p className="text-[11px] text-txt-2 leading-relaxed">{item.summary}</p>}
        <p className="text-[9px] text-txt-3 font-mono mt-2">
          Created {timeAgo(item.created_at)} · Updated {timeAgo(item.updated_at)}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">

        {/* Enrichment data (content blob) */}
        {contentKeys.length > 0 && (
          <div>
            <p className="text-[9px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Enrichment Data</p>
            <div className="bg-bg rounded-lg border border-border p-3 max-h-[180px] overflow-y-auto">
              <pre className="text-[9px] font-mono text-txt-2 whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(item.content, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <p className="text-[9px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Analyst Notes</p>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setDirty(true) }}
            placeholder="Add your analysis, context, or observations..."
            rows={8}
            className="w-full bg-bg border border-border rounded-lg text-txt text-[11px] px-3 py-2 outline-none focus:border-purple transition-colors resize-none font-mono leading-relaxed"
          />
        </div>

        {/* Tags */}
        <div>
          <p className="text-[9px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((t) => <TagPill key={t} tag={t} onRemove={() => removeTag(t)} />)}
          </div>
          <div className="flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
              placeholder="Add tag, press Enter"
              className="flex-1 bg-bg border border-border rounded-lg text-txt text-[10px] px-3 py-1.5 outline-none focus:border-purple transition-colors"
            />
            <button onClick={addTag} className="px-3 py-1.5 text-[9px] font-bold rounded-lg border border-border text-txt-3 bg-transparent hover:border-purple cursor-pointer transition-colors">Add</button>
          </div>
        </div>

        {/* TLP */}
        <div>
          <p className="text-[9px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Traffic Light Protocol</p>
          <div className="flex gap-2">
            {TLP_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => { setTlp(t); setDirty(true) }}
                className={['px-2 py-1 text-[8px] font-bold rounded border transition-all cursor-pointer', tlp === t ? 'opacity-100' : 'opacity-40 hover:opacity-70'].join(' ')}
                style={{ color: TLP_COLOR[t], borderColor: TLP_COLOR[t], background: tlp === t ? `${TLP_COLOR[t]}20` : 'transparent' }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-6 py-3 border-t border-border flex items-center gap-3 flex-shrink-0">
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saveMut.isPending}
            className="px-4 py-2 text-[10px] font-bold tracking-[0.1em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90"
          >
            {saveMut.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        )}
        {!dirty && saveMut.isSuccess && (
          <span className="text-[10px] text-green">Saved</span>
        )}
        <div className="ml-auto">
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="text-[9px] text-txt-3 hover:text-red bg-transparent border-none cursor-pointer transition-colors"
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-txt-3">Are you sure?</span>
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="text-[9px] font-bold text-red hover:underline bg-transparent border-none cursor-pointer"
              >
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="text-[9px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Library() {
  const [typeFilter, setTypeFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creatingNote, setCreatingNote] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['library', search, typeFilter, tagFilter],
    queryFn: () => api.listLibrary({ q: search, type: typeFilter, tag: tagFilter }),
    refetchOnWindowFocus: true,
  })

  const items = data?.items ?? []
  const tags = data?.tags ?? []
  const counts = data?.counts ?? {}

  const selected = items.find((i) => i.id === selectedId) ?? null

  function handleDeleted() {
    setSelectedId(null)
  }

  function handleNewNoteSaved(item: LibraryItem) {
    setCreatingNote(false)
    setSelectedId(item.id)
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* Left panel — list */}
      <div className="w-[320px] flex-shrink-0 border-r border-border flex flex-col h-full">

        {/* Header */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-txt">Intelligence Library</h2>
            <button
              onClick={() => { setCreatingNote(true); setSelectedId(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold tracking-[0.1em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer transition-opacity hover:opacity-90"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Note
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, summary, notes…"
              className="w-full bg-bg border border-border rounded-lg text-txt text-[10px] pl-8 pr-3 py-2 outline-none focus:border-purple transition-colors"
            />
          </div>

          {/* Type tabs */}
          <div className="flex gap-1 flex-wrap">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setTypeFilter(tab.value)}
                className={[
                  'px-2.5 py-1 text-[8px] font-bold tracking-[0.1em] uppercase rounded-full border transition-all cursor-pointer',
                  typeFilter === tab.value
                    ? 'border-purple text-purple bg-purple/10'
                    : 'border-border text-txt-3 bg-transparent hover:border-border2',
                ].join(' ')}
              >
                {tab.label}
                {counts[tab.value || 'all'] !== undefined && (
                  <span className="ml-1 opacity-60">{counts[tab.value || 'all']}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tag cloud */}
        {tags.length > 0 && (
          <div className="px-4 py-2.5 border-b border-border/50 flex-shrink-0 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setTagFilter(tagFilter === t ? '' : t)}
                className="text-[10px] font-bold bg-transparent border-none cursor-pointer p-0 leading-none transition-opacity"
                style={{ color: tagColor(t), opacity: tagFilter && tagFilter !== t ? 0.4 : 1 }}
              >
                #{t}
              </button>
            ))}
            {tagFilter && (
              <button onClick={() => setTagFilter('')} className="text-[10px] text-txt-3 bg-transparent border-none cursor-pointer ml-1">✕ clear</button>
            )}
          </div>
        )}

        {/* Item list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-12 gap-2 text-txt-3 text-[11px]">
              <div className="w-3 h-3 border border-purple border-t-transparent rounded-full animate-spin" />
              Loading…
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <div>
                <p className="text-[13px] font-semibold text-txt-2">No items yet</p>
                <p className="text-[11px] text-txt-3 mt-1">
                  {search || typeFilter || tagFilter
                    ? 'Try adjusting your filters'
                    : 'Save an IOC or create a new note to get started'}
                </p>
              </div>
            </div>
          )}
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onClick={() => { setSelectedId(item.id); setCreatingNote(false) }}
            />
          ))}
        </div>
      </div>

      {/* Right panel — detail / create */}
      <div className="flex-1 overflow-hidden bg-bg">
        {creatingNote ? (
          <NewNoteForm onSave={handleNewNoteSaved} onCancel={() => setCreatingNote(false)} />
        ) : selected ? (
          <ItemDetail key={selected.id} item={selected} onDeleted={handleDeleted} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm px-6">
              <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <p className="text-[13px] font-bold text-txt mb-1">Intelligence Library</p>
              <p className="text-[11px] text-txt-3 leading-relaxed">
                Select an item from the list to view and annotate, or click{' '}
                <button onClick={() => setCreatingNote(true)} className="text-purple hover:underline bg-transparent border-none cursor-pointer p-0 font-inherit text-inherit">+ New Note</button>
                {' '}to start documenting your analysis.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
