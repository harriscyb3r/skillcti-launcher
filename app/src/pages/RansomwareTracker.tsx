import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'

// ── API ───────────────────────────────────────────────────────────────────────

const RL_PROXY = '/api/ransomware-live'
const STALE_MS = 65_000

async function rlFetch(path: string): Promise<unknown[]> {
  const res = await fetch(RL_PROXY + path)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(body.detail ?? `HTTP ${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : (data.data ?? data.victims ?? data.groups ?? [])
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RLVictim {
  post_title?: string
  group_name?: string
  country?: string
  activity?: string
  website?: string
  discovered?: string
  published?: string
  description?: string
}

interface RLGroup {
  name?: string
  status?: string
  description?: string
  victims?: number
  added?: string
  last_victim?: string
}

type VictimsTab = 'recent' | 'search' | 'country' | 'sector' | 'monthly'
type MainTab    = 'victims' | 'groups'
type SortDir    = 'asc' | 'desc'

// ── Helpers ───────────────────────────────────────────────────────────────────

function countryFlag(code: string): string {
  if (!code || code.length < 2) return ''
  try {
    return String.fromCodePoint(
      ...code.toUpperCase().slice(0, 2).split('').map(c => 0x1f1e6 + c.charCodeAt(0) - 65),
    )
  } catch { return '' }
}

function groupColor(name: string): { bg: string; fg: string } {
  let h = 0
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x9e3779b9)
  const hue = Math.abs(h) % 360
  return {
    bg: `hsla(${hue},55%,55%,0.12)`,
    fg: `hsl(${hue},70%,68%)`,
  }
}

function fmtDate(s?: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? s.slice(0, 10) : d.toISOString().slice(0, 10)
}

function victimCount(g: RLGroup): number { return +(g.victims ?? 0) }
function isOnline(g: RLGroup): boolean   { return /online|active/i.test(g.status ?? '') }

// ── Primitives ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-txt-3 text-[11px]">
      <div className="w-3.5 h-3.5 rounded-full border border-purple/40 border-t-purple animate-spin" />
      Loading…
    </div>
  )
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <span className="text-2xl opacity-40">{icon}</span>
      <span className="text-[11px] text-txt-3">{text}</span>
    </div>
  )
}

function ApiError({ message }: { message: string }) {
  const isNetwork = /failed to fetch|networkerror|load failed/i.test(message)
  return (
    <div
      className="mx-1 my-4 rounded-lg p-4 text-[11px] leading-relaxed"
      style={{ background: '#ef444408', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
    >
      {isNetwork ? (
        <>
          <p className="font-bold mb-1.5">Backend not reachable</p>
          <p className="text-txt-3 mb-2">Make sure the SkillCTI backend is running on port 8765.</p>
          <code className="block text-[10px] font-mono text-txt-2 bg-bg px-3 py-1.5 rounded border border-border">
            uvicorn main:app --port 8765 --reload
          </code>
        </>
      ) : (
        <>
          <p className="font-bold mb-1">Error</p>
          <p className="text-txt-3">{message}</p>
        </>
      )}
    </div>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────

function GroupBadge({ name }: { name: string }) {
  const c = groupColor(name)
  return (
    <span
      className="inline-block text-[10px] font-bold uppercase tracking-[0.08em] px-1.5 py-[3px] rounded leading-none whitespace-nowrap"
      style={{ background: c.bg, color: c.fg }}
    >
      {name}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const on = isOnline({ status })
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-[3px] rounded leading-none"
      style={
        on
          ? { background: '#22c55e12', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }
          : { background: 'rgba(255,255,255,0.04)', color: 'var(--txt3)', border: '1px solid var(--border)' }
      }
    >
      <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: 'currentColor' }} />
      {on ? 'Online' : status || 'Offline'}
    </span>
  )
}

function SectorChip({ sector }: { sector: string }) {
  return (
    <span className="inline-block text-[10px] font-bold px-1.5 py-[3px] rounded leading-none bg-cyan/10 text-cyan border border-cyan/20 whitespace-nowrap">
      {sector}
    </span>
  )
}

// ── Victim table ──────────────────────────────────────────────────────────────

type VictimSortKey = 'post_title' | 'group_name' | 'country' | 'activity' | 'discovered' | 'published'

function VictimTable({ victims }: { victims: RLVictim[] }) {
  const [sortKey, setSortKey] = useState<VictimSortKey>('discovered')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: VictimSortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => (
    [...victims].sort((a, b) => {
      const va = (a[sortKey] ?? '') as string
      const vb = (b[sortKey] ?? '') as string
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  ), [victims, sortKey, sortDir])

  function Th({ col, label }: { col: VictimSortKey; label: string }) {
    const active = sortKey === col
    return (
      <th
        onClick={() => handleSort(col)}
        className={[
          'px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] select-none cursor-pointer transition-colors whitespace-nowrap',
          active ? 'text-purple' : 'text-txt-3 hover:text-txt-2',
        ].join(' ')}
      >
        {label}{active && <span className="ml-1 opacity-60">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </th>
    )
  }

  if (!victims.length) return <Empty icon="📭" text="No victims found" />

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-bg border-b border-border">
            <Th col="post_title" label="Victim / Title" />
            <Th col="group_name" label="Group" />
            <Th col="country"    label="Country" />
            <Th col="activity"   label="Sector" />
            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-txt-3 whitespace-nowrap">
              Website
            </th>
            <Th col="discovered" label="Discovered" />
            <Th col="published"  label="Published" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((v, i) => (
            <tr
              key={i}
              className="border-b border-border last:border-b-0 hover:bg-surface/40 transition-colors"
            >
              <td className="px-3 py-2 max-w-[240px]">
                <span className="block truncate font-medium text-txt" title={v.post_title}>
                  {v.post_title || v.website || '(unnamed)'}
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {v.group_name
                  ? <GroupBadge name={v.group_name} />
                  : <span className="text-txt-3">—</span>}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-txt-2">
                {v.country
                  ? <span>{countryFlag(v.country)} <span className="font-mono text-[10px]">{v.country}</span></span>
                  : <span className="text-txt-3">—</span>}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {v.activity && v.activity !== 'Not Found'
                  ? <SectorChip sector={v.activity} />
                  : <span className="text-txt-3">—</span>}
              </td>
              <td className="px-3 py-2 max-w-[160px]">
                {v.website ? (
                  <a
                    href={`https://${v.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={v.website}
                    className="block truncate font-mono text-[10px] text-purple hover:underline"
                  >
                    {v.website}
                  </a>
                ) : <span className="text-txt-3">—</span>}
              </td>
              <td className="px-3 py-2 font-mono text-[10px] text-txt-3 whitespace-nowrap">{fmtDate(v.discovered)}</td>
              <td className="px-3 py-2 font-mono text-[10px] text-txt-3 whitespace-nowrap">{fmtDate(v.published)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Sub-tab strip ─────────────────────────────────────────────────────────────

function SubTabs<T extends string>({
  tabs, active, onChange,
}: {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex gap-0 border-b border-border flex-shrink-0">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            'px-4 py-2.5 text-[11px] font-semibold border-b-2 transition-colors cursor-pointer bg-transparent border-l-0 border-r-0 border-t-0 whitespace-nowrap',
            active === t.id
              ? 'text-txt border-b-purple'
              : 'text-txt-3 border-b-transparent hover:text-txt-2',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Filter row helpers ────────────────────────────────────────────────────────

function FilterInput({ value, onChange, onEnter, placeholder }: {
  value: string
  onChange: (v: string) => void
  onEnter?: () => void
  placeholder: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onEnter?.() }}
      placeholder={placeholder}
      className="flex-1 max-w-sm bg-bg border border-border rounded-lg text-txt text-[11px] px-3 py-[7px] outline-none focus:border-purple transition-colors placeholder:text-txt-3"
    />
  )
}

function FilterSelect({ value, onChange, children }: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-bg border border-border rounded-lg text-txt text-[11px] px-3 py-[7px] outline-none focus:border-purple transition-colors min-w-[180px] cursor-pointer"
    >
      {children}
    </select>
  )
}

function ActionBtn({ onClick, disabled, children }: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-[7px] rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple/20"
      style={{ background: 'rgba(168,85,247,0.08)', color: '#a855f7', borderColor: 'rgba(168,85,247,0.2)' }}
    >
      {children}
    </button>
  )
}

function ResultMeta({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold tracking-[0.1em] text-txt-3 uppercase mb-3">{children}</p>
  )
}

// ── Victims pane ──────────────────────────────────────────────────────────────

function VictimsPane() {
  const [tab,            setTab]            = useState<VictimsTab>('recent')
  const [searchInput,    setSearchInput]    = useState('')
  const [confirmedSearch, setConfirmedSearch] = useState('')
  const [countryPending, setCountryPending] = useState('')
  const [countryCode,    setCountryCode]    = useState('')
  const [sectorPending,  setSectorPending]  = useState('')
  const [sector,         setSector]         = useState('')
  const [year,           setYear]           = useState('2026')
  const [month,          setMonth]          = useState('06')
  const [yearPending,    setYearPending]    = useState('2026')
  const [monthPending,   setMonthPending]   = useState('06')

  const recentQ = useQuery<unknown[]>({
    queryKey: ['rl-recent'],
    queryFn:  () => rlFetch('/recentvictims'),
    staleTime: STALE_MS, retry: false,
  })
  const searchQ = useQuery<unknown[]>({
    queryKey: ['rl-search', confirmedSearch],
    queryFn:  () => rlFetch(`/searchvictims/${encodeURIComponent(confirmedSearch)}`),
    enabled: !!confirmedSearch, staleTime: STALE_MS, retry: false,
  })
  const countryQ = useQuery<unknown[]>({
    queryKey: ['rl-country', countryCode],
    queryFn:  () => rlFetch(`/countryvictims/${encodeURIComponent(countryCode)}`),
    enabled: !!countryCode, staleTime: STALE_MS, retry: false,
  })
  const sectorQ = useQuery<unknown[]>({
    queryKey: ['rl-sector', sector],
    queryFn:  () => rlFetch(`/sectorvictims/${encodeURIComponent(sector)}`),
    enabled: !!sector, staleTime: STALE_MS, retry: false,
  })
  const monthlyQ = useQuery<unknown[]>({
    queryKey: ['rl-monthly', year, month],
    queryFn:  () => rlFetch(`/victims/${year}/${month}`),
    enabled: !!(year && month), staleTime: STALE_MS, retry: false,
  })

  const recent = (recentQ.data ?? []) as RLVictim[]
  const countries = useMemo(() => [...new Set(recent.map(v => v.country).filter(Boolean))].sort() as string[], [recent])
  const sectors   = useMemo(() => [...new Set(recent.map(v => v.activity).filter(Boolean).filter(a => a !== 'Not Found'))].sort() as string[], [recent])

  const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December']

  const SUB_TABS: { id: VictimsTab; label: string }[] = [
    { id: 'recent',  label: 'Recent'     },
    { id: 'search',  label: 'Search'     },
    { id: 'country', label: 'By Country' },
    { id: 'sector',  label: 'By Sector'  },
    { id: 'monthly', label: 'By Month'   },
  ]

  function renderContent() {
    if (tab === 'recent') {
      if (recentQ.isLoading) return <Spinner />
      if (recentQ.isError)   return <ApiError message={(recentQ.error as Error).message} />
      return (<>
        <ResultMeta>{recent.length} recent victims · latest leak-site posts</ResultMeta>
        <VictimTable victims={recent} />
      </>)
    }

    if (tab === 'search') return (
      <div>
        <div className="flex gap-2 mb-5">
          <FilterInput
            value={searchInput}
            onChange={setSearchInput}
            onEnter={() => { if (searchInput.trim()) setConfirmedSearch(searchInput.trim()) }}
            placeholder="Search victim names, domains, descriptions…"
          />
          <ActionBtn onClick={() => { if (searchInput.trim()) setConfirmedSearch(searchInput.trim()) }} disabled={!searchInput.trim()}>
            Search
          </ActionBtn>
        </div>
        {!confirmedSearch && <Empty icon="🔍" text="Enter a keyword to search all victims" />}
        {confirmedSearch && searchQ.isLoading && <Spinner />}
        {confirmedSearch && searchQ.isError   && <ApiError message={(searchQ.error as Error).message} />}
        {confirmedSearch && searchQ.data && (<>
          <ResultMeta>
            {(searchQ.data as RLVictim[]).length} results for &ldquo;{confirmedSearch}&rdquo;
          </ResultMeta>
          <VictimTable victims={searchQ.data as RLVictim[]} />
        </>)}
      </div>
    )

    if (tab === 'country') return (
      <div>
        <div className="flex gap-2 mb-5 items-center">
          <FilterSelect value={countryPending} onChange={setCountryPending}>
            <option value="">Select country…</option>
            {countries.map(c => <option key={c} value={c}>{countryFlag(c)} {c}</option>)}
          </FilterSelect>
          <ActionBtn onClick={() => { if (countryPending) setCountryCode(countryPending) }} disabled={!countryPending}>
            Load
          </ActionBtn>
        </div>
        {!countryCode && <Empty icon="🌍" text="Select a country to view victims" />}
        {countryCode && countryQ.isLoading && <Spinner />}
        {countryCode && countryQ.isError   && <ApiError message={(countryQ.error as Error).message} />}
        {countryCode && countryQ.data && (<>
          <ResultMeta>
            {(countryQ.data as RLVictim[]).length} victims · {countryFlag(countryCode)} {countryCode}
          </ResultMeta>
          <VictimTable victims={countryQ.data as RLVictim[]} />
        </>)}
      </div>
    )

    if (tab === 'sector') return (
      <div>
        <div className="flex gap-2 mb-5 items-center">
          <FilterSelect value={sectorPending} onChange={setSectorPending}>
            <option value="">Select sector…</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
          <ActionBtn onClick={() => { if (sectorPending) setSector(sectorPending) }} disabled={!sectorPending}>
            Load
          </ActionBtn>
        </div>
        {!sector && <Empty icon="🏭" text="Select a sector to view victims" />}
        {sector && sectorQ.isLoading && <Spinner />}
        {sector && sectorQ.isError   && <ApiError message={(sectorQ.error as Error).message} />}
        {sector && sectorQ.data && (<>
          <ResultMeta>
            {(sectorQ.data as RLVictim[]).length} victims · {sector}
          </ResultMeta>
          <VictimTable victims={sectorQ.data as RLVictim[]} />
        </>)}
      </div>
    )

    if (tab === 'monthly') return (
      <div>
        <div className="flex gap-2 mb-5 items-center">
          <FilterSelect value={yearPending} onChange={setYearPending}>
            {['2026','2025','2024','2023','2022','2021'].map(y => <option key={y}>{y}</option>)}
          </FilterSelect>
          <FilterSelect value={monthPending} onChange={setMonthPending}>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
              <option key={m} value={m}>{MONTHS[i + 1]}</option>
            ))}
          </FilterSelect>
          <ActionBtn onClick={() => { setYear(yearPending); setMonth(monthPending) }}>
            Load
          </ActionBtn>
        </div>
        {monthlyQ.isLoading && <Spinner />}
        {monthlyQ.isError   && <ApiError message={(monthlyQ.error as Error).message} />}
        {monthlyQ.data && (<>
          <ResultMeta>
            {(monthlyQ.data as RLVictim[]).length} victims · {MONTHS[+month]} {year}
          </ResultMeta>
          <VictimTable victims={monthlyQ.data as RLVictim[]} />
        </>)}
      </div>
    )

    return null
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabs tabs={SUB_TABS} active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-5">
        {renderContent()}
      </div>
    </div>
  )
}

// ── Group detail ──────────────────────────────────────────────────────────────

function GroupDetail({ group }: { group: RLGroup }) {
  const name  = group.name ?? ''
  const count = victimCount(group)
  const countColor = count > 200 ? '#ef4444' : count > 50 ? '#f59e0b' : '#22c55e'

  const victimsQ = useQuery<unknown[]>({
    queryKey: ['rl-groupvictims', name],
    queryFn:  () => rlFetch(`/groupvictims/${encodeURIComponent(name)}`),
    enabled:  false,
    staleTime: STALE_MS,
    retry: false,
  })
  const [loadedVictims, setLoadedVictims] = useState(false)

  function loadVictims() {
    setLoadedVictims(true)
    victimsQ.refetch()
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Sticky header */}
      <div className="px-6 py-5 border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded leading-none"
                style={{ background: groupColor(name).bg, color: groupColor(name).fg }}
              >
                {name}
              </span>
              <StatusBadge status={group.status ?? 'unknown'} />
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[13px] font-bold" style={{ color: countColor }}>
                {count.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold tracking-[0.12em] text-txt-3 uppercase">victims</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-1">First Seen</p>
            <p className="text-[11px] text-txt font-mono">{fmtDate(group.added)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-1">Last Victim</p>
            <p className="text-[11px] text-txt font-mono">{fmtDate(group.last_victim)}</p>
          </div>
        </div>

        {/* Description */}
        {group.description && (
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Overview</p>
            <p className="text-[11px] text-txt-2 leading-relaxed">{group.description}</p>
          </div>
        )}

        {/* Victims */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold tracking-[0.15em] text-txt-3 uppercase">Victims</p>
            {!loadedVictims && (
              <button
                onClick={loadVictims}
                className="text-[10px] font-bold px-2 py-1 rounded cursor-pointer transition-colors hover:bg-purple/20 border border-purple/20"
                style={{ background: 'rgba(168,85,247,0.08)', color: '#a855f7' }}
              >
                Load victims
              </button>
            )}
          </div>
          {loadedVictims && victimsQ.isLoading && <Spinner />}
          {loadedVictims && victimsQ.isError   && <ApiError message={(victimsQ.error as Error).message} />}
          {loadedVictims && victimsQ.data && (
            <VictimTable victims={victimsQ.data as RLVictim[]} />
          )}
          {!loadedVictims && (
            <p className="text-[10px] text-txt-3">
              Click &ldquo;Load victims&rdquo; to fetch this group&apos;s full victim list.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Groups pane ───────────────────────────────────────────────────────────────

function GroupsPane() {
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<RLGroup | null>(null)

  const groupsQ = useQuery<unknown[]>({
    queryKey: ['rl-groups'],
    queryFn:  () => rlFetch('/groups'),
    staleTime: STALE_MS, retry: false,
  })

  const groups   = (groupsQ.data ?? []) as RLGroup[]
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return q ? groups.filter(g => (g.name ?? '').toLowerCase().includes(q)) : groups
  }, [groups, search])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left list */}
      <div className="w-[220px] flex-shrink-0 border-r border-border flex flex-col h-full bg-surface/30">
        <div className="p-3 border-b border-border flex-shrink-0 flex flex-col gap-2">
          <div className="relative">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter groups…"
              className="w-full bg-bg border border-border rounded-lg text-txt text-[11px] pl-7 pr-3 py-[7px] outline-none focus:border-purple transition-colors placeholder:text-txt-3"
            />
          </div>
          <p className="text-[10px] font-mono text-txt-3 h-[14px]">
            {groupsQ.isLoading ? '' : `${filtered.length} groups`}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groupsQ.isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-txt-3 text-[10px]">
              <div className="w-3 h-3 rounded-full border border-purple/40 border-t-purple animate-spin" />
            </div>
          )}
          {groupsQ.isError && <ApiError message={(groupsQ.error as Error).message} />}
          {filtered.map(g => {
            const sel    = selected?.name === g.name
            const online = isOnline(g)
            return (
              <button
                key={g.name}
                onClick={() => setSelected(g)}
                className={[
                  'w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors cursor-pointer bg-transparent border-l-0 border-r-0 border-t-0',
                  sel ? 'bg-purple/[0.07]' : 'hover:bg-surface/60',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={['text-[11px] font-bold truncate flex-1', sel ? 'text-purple' : 'text-txt'].join(' ')}>
                    {g.name}
                  </span>
                  <span
                    className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                    style={{ background: online ? '#22c55e' : 'var(--txt3)' }}
                  />
                </div>
                <p className="text-[10px] font-mono text-txt-3">
                  {victimCount(g).toLocaleString()} victims
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right detail */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <GroupDetail key={selected.name} group={selected} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-txt-3 opacity-40">
              <circle cx="12" cy="8" r="4" />
              <path d="M8 8v6l4 2 4-2V8" />
              <path d="M12 20c-4 0-7-2.5-7-6M19 14c0 3.5-3 6-7 6" />
            </svg>
            <div>
              <p className="text-[13px] font-bold text-txt mb-1.5">Ransomware Groups</p>
              <p className="text-[11px] text-txt-3 leading-relaxed max-w-[240px]">
                Select a group to view their profile, activity status, and victim list.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RansomwareTracker() {
  const [mainTab, setMainTab] = useState<MainTab>('victims')

  const groupsQ = useQuery<unknown[]>({
    queryKey: ['rl-groups'],
    queryFn:  () => rlFetch('/groups'),
    staleTime: STALE_MS, retry: false,
  })
  const recentQ = useQuery<unknown[]>({
    queryKey: ['rl-recent'],
    queryFn:  () => rlFetch('/recentvictims'),
    staleTime: STALE_MS, retry: false,
  })

  const groups = (groupsQ.data ?? []) as RLGroup[]
  const recent = (recentQ.data ?? []) as RLVictim[]
  const total  = groups.reduce((s, g) => s + victimCount(g), 0)
  const online = groups.filter(isOnline).length

  function Stat({ n, label }: { n: number | string; label: string }) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-bold text-txt tabular-nums">{n || '—'}</span>
        <span className="text-[10px] font-bold tracking-[0.12em] text-txt-3 uppercase">{label}</span>
      </div>
    )
  }

  const MAIN_TABS: { id: MainTab; label: string }[] = [
    { id: 'victims', label: 'Victims' },
    { id: 'groups',  label: 'Groups'  },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Page header ── */}
      <div className="px-5 pt-5 pb-0 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between gap-4 mb-4">
          {/* Title */}
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-[18px] font-bold text-txt leading-none tracking-tight">Ransomware Tracker</h1>
              <span
                className="text-[10px] font-bold tracking-[0.14em] px-2 py-[3px] rounded leading-none"
                style={{ background: '#ef444412', color: '#ef4444' }}
              >
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-txt-3">
              Live victim & group data ·{' '}
              <a href="https://ransomware.live" target="_blank" rel="noopener noreferrer"
                className="text-purple hover:underline">
                ransomware.live
              </a>
            </p>
          </div>

          {/* Stats chips */}
          <div className="flex items-center gap-5 flex-shrink-0 pt-1">
            <Stat n={total ? total.toLocaleString() : '—'} label="Total Tracked" />
            <div className="w-px h-4 bg-border" />
            <Stat n={groups.length || '—'} label="Groups" />
            <div className="w-px h-4 bg-border" />
            <Stat n={recent.length || '—'} label="Recent" />
            <div className="w-px h-4 bg-border" />
            <Stat n={online || '—'} label="Online" />
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-0">
          {MAIN_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id)}
              className={[
                'px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer bg-transparent border-l-0 border-r-0 border-t-0 whitespace-nowrap',
                mainTab === t.id
                  ? 'text-txt border-b-purple'
                  : 'text-txt-3 border-b-transparent hover:text-txt-2',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">
        {mainTab === 'victims' ? <VictimsPane /> : <GroupsPane />}
      </div>

    </div>
  )
}
