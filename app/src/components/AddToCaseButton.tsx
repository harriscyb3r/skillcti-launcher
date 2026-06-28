import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { ArtifactType, Case } from '../lib/types'

interface Props {
  artifactType: ArtifactType
  value: string
  label?: string
  variant?: 'compact' | 'full'
}

const STATUS_DOT: Record<string, string> = {
  'open': '#22c55e',
  'in-progress': '#f59e0b',
  'closed': '#6b7280',
}

function CaseDropdown({
  cases,
  loading,
  adding,
  onAdd,
}: {
  cases: Case[] | null
  loading: boolean
  adding: string | null
  onAdd: (c: Case) => void
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-lg shadow-xl overflow-hidden"
      style={{ minWidth: '210px', maxWidth: '270px' }}
    >
      <div className="px-3 py-2 border-b border-border">
        <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">Add to Case</p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-3">
          <div className="w-3 h-3 border border-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] text-txt-3">Loading cases…</span>
        </div>
      ) : !cases || cases.length === 0 ? (
        <div className="px-3 py-3">
          <p className="text-[11px] text-txt-3 mb-1">No open cases.</p>
          <a href="/cases" className="text-[11px] text-purple hover:underline">Create a case →</a>
        </div>
      ) : (
        <div className="max-h-[220px] overflow-y-auto">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => onAdd(c)}
              disabled={adding === c.id}
              className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-bg/60 transition-colors bg-transparent border-none cursor-pointer disabled:opacity-60"
            >
              <div
                className="w-1.5 h-1.5 rounded-full mt-[5px] flex-shrink-0"
                style={{ background: STATUS_DOT[c.status] ?? '#6b7280' }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-txt truncate">{c.title}</p>
                <p className="text-[11px] text-txt-3 capitalize">
                  {c.status.replace('-', ' ')} · {c.artifact_count} artifact{c.artifact_count !== 1 ? 's' : ''}
                </p>
              </div>
              {adding === c.id && (
                <div className="w-3 h-3 border border-purple border-t-transparent rounded-full animate-spin flex-shrink-0 mt-1" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AddToCaseButton({ artifactType, value, label, variant = 'compact' }: Props) {
  const [open, setOpen] = useState(false)
  const [cases, setCases] = useState<Case[] | null>(null)
  const [loadingCases, setLoadingCases] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [addedTo, setAddedTo] = useState<{ id: string; title: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || cases !== null) return
    setLoadingCases(true)
    api.listCases()
      .then((r) => {
        setCases(r.cases.filter((c) => c.status !== 'closed'))
        setLoadingCases(false)
      })
      .catch(() => {
        setCases([])
        setLoadingCases(false)
      })
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function handleAdd(c: Case) {
    setAdding(c.id)
    try {
      await api.addCaseArtifact(c.id, artifactType, value, label ?? value)
      setAddedTo({ id: c.id, title: c.title })
      setOpen(false)
      setTimeout(() => setAddedTo(null), 3500)
    } catch {
      // leave dropdown open so the user can retry
    } finally {
      setAdding(null)
    }
  }

  const added = addedTo !== null
  const truncTitle = addedTo
    ? addedTo.title.length > 18 ? addedTo.title.slice(0, 18) + '…' : addedTo.title
    : ''

  const folderPlusIcon = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  )
  const checkIcon = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
  const spinner = <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />

  if (variant === 'full') {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => { if (!added) setOpen((o) => !o) }}
          title={added ? `Added to ${addedTo!.title}` : 'Add to Case'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer bg-transparent"
          style={{
            borderColor: added ? '#22c55e' : open ? '#a855f7' : '#4b5563',
            color: added ? '#22c55e' : open ? '#a855f7' : '#9ca3af',
          }}
        >
          {adding ? spinner : added ? checkIcon : folderPlusIcon}
          {added ? `Added to ${truncTitle}` : 'Add to Case'}
        </button>
        {open && (
          <CaseDropdown cases={cases} loading={loadingCases} adding={adding} onAdd={handleAdd} />
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { if (!added) setOpen((o) => !o) }}
        title={added ? `Added to ${addedTo!.title}` : 'Add to Case'}
        className="flex items-center gap-1 text-[11px] font-bold bg-transparent border-none cursor-pointer transition-colors"
        style={{ color: added ? '#22c55e' : open ? '#a855f7' : '#6b7280' }}
      >
        {adding ? spinner : added ? checkIcon : folderPlusIcon}
        {added ? 'Added' : 'Case'}
      </button>
      {open && (
        <CaseDropdown cases={cases} loading={loadingCases} adding={adding} onAdd={handleAdd} />
      )}
    </div>
  )
}
