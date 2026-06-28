import { useState, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Client, ClientStatus, CreateClientRequest, UpdateClientRequest, Skill } from '../lib/types'
import { SKILLS } from '../lib/skills'
import LaunchDrawer from '../components/LaunchDrawer'
import ReportModal from '../components/ReportModal'

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<ClientStatus, { label: string; color: string }> = {
  active:      { label: 'Active',      color: '#22c55e' },
  prospecting: { label: 'Prospecting', color: '#a855f7' },
  on_hold:     { label: 'On Hold',     color: '#f59e0b' },
  completed:   { label: 'Completed',   color: '#6b7280' },
}

function buildClientContext(client: Client): string {
  const lines = [
    'CLIENT ENGAGEMENT CONTEXT',
    `Client: ${client.name}`,
    client.industry      ? `Industry: ${client.industry}`           : '',
    client.engagement_ref ? `Engagement Ref: ${client.engagement_ref}` : '',
    client.contact_name  ? `Contact: ${client.contact_name}${client.contact_email ? ' <' + client.contact_email + '>' : ''}` : '',
  ].filter(Boolean)

  if (client.key_assets.trim()) {
    lines.push('', 'Key Assets:', client.key_assets.trim())
  }
  if (client.threat_context.trim()) {
    lines.push('', 'Threat Context:', client.threat_context.trim())
  }

  return lines.join('\n')
}

const REPORT_SKILL_IDS = [
  'operational', 'tactical', 'strategic', 'sector',
  'security-advisory', 'threat-actor-profile', 'detection-as-code',
  'tabletop', 'threat-model',
]

// ── ClientForm ────────────────────────────────────────────────────────────────

interface FormData {
  name: string
  industry: string
  engagement_ref: string
  status: ClientStatus
  key_assets: string
  threat_context: string
  contact_name: string
  contact_email: string
  notes: string
}

function emptyForm(): FormData {
  return {
    name: '', industry: '', engagement_ref: '', status: 'active',
    key_assets: '', threat_context: '', contact_name: '', contact_email: '', notes: '',
  }
}

function clientToForm(c: Client): FormData {
  return {
    name: c.name, industry: c.industry, engagement_ref: c.engagement_ref,
    status: c.status, key_assets: c.key_assets, threat_context: c.threat_context,
    contact_name: c.contact_name, contact_email: c.contact_email, notes: c.notes,
  }
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 uppercase block mb-[5px]">
      {children}{required && <span className="text-red ml-1">*</span>}
    </label>
  )
}

function inputCls() {
  return 'w-full bg-bg border border-border rounded-md text-txt text-[12px] px-3 py-2 outline-none focus:border-purple transition-colors'
}

function textareaCls() {
  return 'w-full bg-bg border border-border rounded-md text-txt text-[12px] px-3 py-2 outline-none focus:border-purple transition-colors resize-none'
}

// ── ClientDetail ──────────────────────────────────────────────────────────────

function ClientDetail({ client, onDeleted }: { client: Client; onDeleted: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormData>(clientToForm(client))
  const [launchSkill, setLaunchSkill] = useState<Skill | null>(null)
  const [reportHtml, setReportHtml] = useState('')
  const [showSkillPicker, setShowSkillPicker] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const reportSkills = SKILLS.filter((s) => REPORT_SKILL_IDS.includes(s.id) && !s.hidden)

  const updateMut = useMutation({
    mutationFn: (data: UpdateClientRequest) => api.updateClient(client.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setEditing(false)
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => api.deleteClient(client.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      onDeleted()
    },
  })

  const sm = STATUS_META[client.status]
  const clientContext = buildClientContext(client)

  function handleSave() {
    if (!form.name.trim()) return
    updateMut.mutate({ ...form })
  }

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }))
  }

  if (editing) {
    return (
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-txt">Edit Client</h2>
          <button
            onClick={() => { setEditing(false); setForm(clientToForm(client)) }}
            className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
          >
            Cancel
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FieldLabel required>Client Name</FieldLabel>
            <input className={inputCls()} value={form.name} onChange={set('name')} placeholder="ACME Corporation" />
          </div>
          <div>
            <FieldLabel>Industry</FieldLabel>
            <input className={inputCls()} value={form.industry} onChange={set('industry')} placeholder="Financial Services" />
          </div>
          <div>
            <FieldLabel>Engagement Ref</FieldLabel>
            <input className={inputCls()} value={form.engagement_ref} onChange={set('engagement_ref')} placeholder="ENG-2026-001" />
          </div>
          <div>
            <FieldLabel>Contact Name</FieldLabel>
            <input className={inputCls()} value={form.contact_name} onChange={set('contact_name')} placeholder="Jane Smith" />
          </div>
          <div>
            <FieldLabel>Contact Email</FieldLabel>
            <input className={inputCls()} value={form.contact_email} onChange={set('contact_email')} type="email" placeholder="jane@acme.com" />
          </div>
          <div className="col-span-2">
            <FieldLabel>Status</FieldLabel>
            <select className={inputCls()} value={form.status} onChange={set('status')}>
              {(Object.keys(STATUS_META) as ClientStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <FieldLabel>Key Assets</FieldLabel>
            <textarea className={textareaCls()} rows={3} value={form.key_assets} onChange={set('key_assets')}
              placeholder="M365, Azure AD, PeopleSoft, AWS S3 — key systems and infrastructure" />
          </div>
          <div className="col-span-2">
            <FieldLabel>Threat Context</FieldLabel>
            <textarea className={textareaCls()} rows={4} value={form.threat_context} onChange={set('threat_context')}
              placeholder="ASX-listed financial services. Targeted by APT groups active in the APAC finance sector. Regulatory: APRA CPS 234, Essential Eight ML2." />
          </div>
          <div className="col-span-2">
            <FieldLabel>Notes</FieldLabel>
            <textarea className={textareaCls()} rows={3} value={form.notes} onChange={set('notes')}
              placeholder="Internal engagement notes, key contacts, milestones…" />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!form.name.trim() || updateMut.isPending}
            className="px-5 py-2 text-[11px] font-bold rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40"
          >
            {updateMut.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          {updateMut.isError && (
            <span className="text-[11px] text-red self-center">Save failed.</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold text-txt leading-snug">{client.name}</h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {client.industry && (
              <span className="text-[12px] text-txt-3">{client.industry}</span>
            )}
            {client.engagement_ref && (
              <span className="text-[11px] font-mono text-txt-3 bg-bg border border-border px-2 py-0.5 rounded">
                {client.engagement_ref}
              </span>
            )}
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded"
              style={{ color: sm.color, background: sm.color + '18' }}
            >
              {sm.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-[11px] font-bold border border-border rounded-lg text-txt-2 hover:border-border2 hover:text-txt transition-colors bg-transparent cursor-pointer"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Contact */}
      {(client.contact_name || client.contact_email) && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Contact</p>
          {client.contact_name && <p className="text-[13px] text-txt">{client.contact_name}</p>}
          {client.contact_email && (
            <a href={`mailto:${client.contact_email}`} className="text-[12px] text-purple hover:underline font-mono">
              {client.contact_email}
            </a>
          )}
        </div>
      )}

      {/* Key Assets */}
      {client.key_assets.trim() && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Key Assets</p>
          <p className="text-[12px] text-txt-2 leading-relaxed whitespace-pre-wrap">{client.key_assets}</p>
        </div>
      )}

      {/* Threat Context */}
      {client.threat_context.trim() && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Threat Context</p>
          <p className="text-[12px] text-txt-2 leading-relaxed whitespace-pre-wrap">{client.threat_context}</p>
        </div>
      )}

      {/* Notes */}
      {client.notes.trim() && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Notes</p>
          <p className="text-[12px] text-txt-2 leading-relaxed whitespace-pre-wrap">{client.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        {/* Launch Report */}
        <div className="relative">
          <button
            onClick={() => setShowSkillPicker((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Launch Report
          </button>
          {showSkillPicker && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowSkillPicker(false)} />
              <div className="absolute left-0 top-full mt-1 z-40 bg-surface border border-border rounded-lg shadow-elevated p-2 w-[300px]">
                <p className="text-[10px] font-bold tracking-[0.15em] text-txt-3 uppercase px-2 py-1.5 mb-1">
                  Client context will be auto-attached
                </p>
                {reportSkills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => { setShowSkillPicker(false); setLaunchSkill(skill) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg text-left bg-transparent border-none cursor-pointer transition-colors"
                  >
                    <span
                      className="text-[9px] font-bold px-1.5 py-[3px] rounded border flex-shrink-0 leading-none whitespace-nowrap"
                      style={{ color: skill.badgeColor, borderColor: skill.badgeColor + '55', background: skill.badgeColor + '12' }}
                    >
                      {skill.badge}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-txt">{skill.name}</div>
                      <div className="text-[10px] text-txt-3 truncate">{skill.tagline}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* View Cases */}
        <button
          onClick={() => navigate('/cases')}
          className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-lg border border-border text-txt-2 hover:border-border2 hover:text-txt bg-transparent cursor-pointer transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          View Cases
        </button>

        {/* View PIRs */}
        <button
          onClick={() => navigate('/pir')}
          className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-lg border border-border text-txt-2 hover:border-border2 hover:text-txt bg-transparent cursor-pointer transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          View PIRs
        </button>

        {/* Delete */}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-lg border border-red/30 text-red/70 hover:bg-red/10 hover:text-red bg-transparent cursor-pointer transition-colors"
          >
            Delete Client
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-txt-3">Are you sure?</span>
            <button
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-red text-white border-none cursor-pointer disabled:opacity-50"
            >
              {deleteMut.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* LaunchDrawer + ReportModal */}
      {launchSkill && (
        <LaunchDrawer
          skill={launchSkill}
          clientContext={clientContext}
          onClose={() => setLaunchSkill(null)}
          onReportReady={(html) => { setLaunchSkill(null); setReportHtml(html) }}
        />
      )}
      {reportHtml && <ReportModal html={reportHtml} onClose={() => setReportHtml('')} />}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Clients() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClientStatus | ''>('')
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm())

  const { data, isLoading } = useQuery({
    queryKey: ['clients', statusFilter, search],
    queryFn: () => api.listClients({ status: statusFilter || undefined, q: search || undefined }),
    staleTime: 30_000,
  })

  const createMut = useMutation({
    mutationFn: (data: CreateClientRequest) => api.createClient(data),
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setCreating(false)
      setForm(emptyForm())
      setSelected(client.id)
    },
  })

  const clients = data?.clients ?? []
  const selectedClient = clients.find((c) => c.id === selected) ?? null

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }))
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Client list ── */}
      <div className="w-[280px] flex-shrink-0 border-r border-border flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border flex-shrink-0">
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-0.5">Consulting</p>
          <h1 className="text-[18px] font-bold text-txt tracking-tight">Clients</h1>
        </div>

        {/* Search + filter */}
        <div className="px-3 py-3 border-b border-border flex-shrink-0 flex flex-col gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-full bg-bg border border-border rounded-md text-txt text-[11px] font-mono px-3 py-1.5 outline-none focus:border-purple transition-colors"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ClientStatus | '')}
            className="w-full bg-bg border border-border rounded-md text-txt text-[11px] px-3 py-1.5 outline-none focus:border-purple transition-colors"
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_META) as ClientStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>

        {/* New client button */}
        <div className="px-3 py-2 border-b border-border flex-shrink-0">
          <button
            onClick={() => { setCreating(true); setSelected(null) }}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Client
          </button>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-txt-3 text-[11px]">
              <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
              Loading…
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
              <div className="text-[12px] font-bold text-txt-2">No clients yet</div>
              <div className="text-[11px] text-txt-3">Click New Client to add your first engagement.</div>
            </div>
          ) : (
            clients.map((c) => {
              const sm = STATUS_META[c.status]
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c.id); setCreating(false) }}
                  className={[
                    'w-full text-left px-4 py-3 border-b border-border/50 last:border-0 transition-colors bg-transparent border-l-2 border-none cursor-pointer',
                    selected === c.id
                      ? 'bg-purple/[0.08] border-l-purple'
                      : 'hover:bg-white/[0.03] border-l-transparent',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                      style={{ background: sm.color }}
                    />
                    <span className="text-[12px] font-semibold text-txt truncate flex-1">{c.name}</span>
                  </div>
                  {(c.industry || c.engagement_ref) && (
                    <div className="text-[10px] text-txt-3 truncate mt-0.5 ml-[19px]">
                      {[c.industry, c.engagement_ref].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right: Detail / Create form ── */}
      {creating ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 max-w-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-txt">New Client</h2>
            <button
              onClick={() => { setCreating(false); setForm(emptyForm()) }}
              className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FieldLabel required>Client Name</FieldLabel>
              <input className={inputCls()} value={form.name} onChange={set('name')} placeholder="ACME Corporation" autoFocus />
            </div>
            <div>
              <FieldLabel>Industry</FieldLabel>
              <input className={inputCls()} value={form.industry} onChange={set('industry')} placeholder="Financial Services" />
            </div>
            <div>
              <FieldLabel>Engagement Ref</FieldLabel>
              <input className={inputCls()} value={form.engagement_ref} onChange={set('engagement_ref')} placeholder="ENG-2026-001" />
            </div>
            <div>
              <FieldLabel>Contact Name</FieldLabel>
              <input className={inputCls()} value={form.contact_name} onChange={set('contact_name')} placeholder="Jane Smith" />
            </div>
            <div>
              <FieldLabel>Contact Email</FieldLabel>
              <input className={inputCls()} value={form.contact_email} onChange={set('contact_email')} type="email" placeholder="jane@acme.com" />
            </div>
            <div className="col-span-2">
              <FieldLabel>Status</FieldLabel>
              <select className={inputCls()} value={form.status} onChange={set('status')}>
                {(Object.keys(STATUS_META) as ClientStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <FieldLabel>Key Assets</FieldLabel>
              <textarea className={textareaCls()} rows={3} value={form.key_assets} onChange={set('key_assets')}
                placeholder="M365, Azure AD, PeopleSoft, AWS S3 — key systems and infrastructure" />
            </div>
            <div className="col-span-2">
              <FieldLabel>Threat Context</FieldLabel>
              <textarea className={textareaCls()} rows={4} value={form.threat_context} onChange={set('threat_context')}
                placeholder="ASX-listed financial services. Targeted by APT groups active in the APAC finance sector. Regulatory: APRA CPS 234, Essential Eight ML2." />
            </div>
            <div className="col-span-2">
              <FieldLabel>Notes</FieldLabel>
              <textarea className={textareaCls()} rows={3} value={form.notes} onChange={set('notes')}
                placeholder="Internal engagement notes, key contacts, milestones…" />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => createMut.mutate({ ...form })}
              disabled={!form.name.trim() || createMut.isPending}
              className="px-5 py-2 text-[11px] font-bold rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40"
            >
              {createMut.isPending ? 'Creating…' : 'Create Client'}
            </button>
            {createMut.isError && (
              <span className="text-[11px] text-red self-center">Create failed.</span>
            )}
          </div>
        </div>
      ) : selectedClient ? (
        <ClientDetail
          key={selectedClient.id}
          client={selectedClient}
          onDeleted={() => setSelected(null)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-txt-3">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div className="text-[13px] font-bold text-txt-2">Select a client</div>
          <div className="text-[11px] text-txt-3 max-w-[240px]">
            Choose a client from the list, or create a new one to track engagements and launch contextual reports.
          </div>
          <button
            onClick={() => setCreating(true)}
            className="mt-2 px-4 py-2 text-[11px] font-bold rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer hover:opacity-90"
          >
            + New Client
          </button>
        </div>
      )}
    </div>
  )
}
