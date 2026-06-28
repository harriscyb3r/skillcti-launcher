import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTheme, THEMES } from '../lib/theme'
import { toast } from '../lib/useToast'
import type { AppSettings } from '../lib/types'

const FIELDS: { key: keyof AppSettings; label: string; hint: string; sensitive: boolean }[] = [
  {
    key: 'anthropic_api_key',
    label: 'Anthropic API Key',
    hint: 'Required for all report generation. Starts with sk-ant-',
    sensitive: true,
  },
  {
    key: 'virustotal_api_key',
    label: 'VirusTotal API Key',
    hint: 'Used by IOC enrichment skill for file hash and URL lookups.',
    sensitive: true,
  },
  {
    key: 'abuseipdb_api_key',
    label: 'AbuseIPDB API Key',
    hint: 'Used by IOC enrichment skill for IP reputation lookups.',
    sensitive: true,
  },
  {
    key: 'urlscan_api_key',
    label: 'urlscan.io API Key',
    hint: 'Used by IOC enrichment skill for URL and domain analysis.',
    sensitive: true,
  },
  {
    key: 'shodan_api_key',
    label: 'Shodan API Key',
    hint: 'Optional. Used for port/banner enrichment on IP addresses.',
    sensitive: true,
  },
  {
    key: 'threatfox_api_key',
    label: 'ThreatFox API Key',
    hint: 'Optional. Used for IOC lookups against the Abuse.ch ThreatFox database.',
    sensitive: true,
  },
  {
    key: 'hybrid_analysis_api_key',
    label: 'Hybrid Analysis API Key',
    hint: 'Optional. Used by Malware Intel for sandbox analysis. Free key at hybrid-analysis.com.',
    sensitive: true,
  },
  {
    key: 'hibp_api_key',
    label: 'HaveIBeenPwned API Key',
    hint: 'Optional. Enables domain credential exposure checks in Breach Monitor. Free key at haveibeenpwned.com/API/Key.',
    sensitive: true,
  },
  {
    key: 'otx_api_key',
    label: 'AlienVault OTX API Key',
    hint: 'Optional. Enables OTX pulse feed, IOC enrichment, and threat intelligence from the Open Threat Exchange. Free key at otx.alienvault.com.',
    sensitive: true,
  },
  {
    key: 'proxycheck_api_key',
    label: 'proxycheck.io API Key',
    hint: 'Required for VPN/proxy/Tor detection on IP addresses. VPN detection is only accurate with a key — the unauthenticated API returns unreliable results. Free account at proxycheck.io (1,000 queries/day).',
    sensitive: true,
  },
  {
    key: 'misp_url',
    label: 'MISP URL',
    hint: 'Base URL of your local MISP instance (e.g. http://localhost). Run MISP via Docker: github.com/MISP/misp-docker.',
    sensitive: false,
  },
  {
    key: 'misp_api_key',
    label: 'MISP API Key',
    hint: 'Your MISP automation key. Generate in MISP under Administration → List Auth Keys.',
    sensitive: true,
  },
  {
    key: 'default_tlp',
    label: 'Default TLP Classification',
    hint: 'Default Traffic Light Protocol classification for new reports (e.g. TLP:AMBER).',
    sensitive: false,
  },
  {
    key: 'geography',
    label: 'Region / Geography',
    hint: 'Your region for the dashboard Regional Threat Pulse (e.g. Australia, APAC, United Kingdom, United States).',
    sensitive: false,
  },
]

const EMPTY: AppSettings = {
  anthropic_api_key: '',
  virustotal_api_key: '',
  abuseipdb_api_key: '',
  urlscan_api_key: '',
  shodan_api_key: '',
  threatfox_api_key: '',
  hybrid_analysis_api_key: '',
  hibp_api_key: '',
  otx_api_key: '',
  proxycheck_api_key: '',
  misp_url: '',
  misp_api_key: '',
  default_tlp: 'TLP:AMBER',
  geography: '',
}

function isMasked(v: string) {
  return v.includes('•')
}

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const [form, setForm] = useState<AppSettings>(EMPTY)
  const [saved, setSaved] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  // Track which fields were loaded with a masked (configured) value
  const loadedMasked = useRef<Record<string, boolean>>({})

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  })

  useEffect(() => {
    if (data) {
      const masked: Record<string, boolean> = {}
      Object.entries(data).forEach(([k, v]) => {
        if (isMasked(v as string)) masked[k] = true
      })
      loadedMasked.current = masked
      setForm({ ...EMPTY, ...data })
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      toast('Settings saved', 'success')
    },
    onError: () => {
      toast('Failed to save settings', 'error')
    },
  })

  function handleChange(key: keyof AppSettings, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(form)
  }

  function toggleShow(key: string) {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="p-6 max-w-xl">
      <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Configuration</p>
      <h1 className="text-[22px] font-bold text-txt tracking-tight mb-1">Settings</h1>
      <p className="text-[13px] text-txt-2 mb-6">
        API keys are stored in backend/.env on your local machine and never leave it.
      </p>

      <div className="mb-8">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Appearance</p>
        <div className="bg-surface border border-border rounded-lg shadow-card p-4">
          <div className="text-[13px] font-bold text-txt mb-1">Theme</div>
          <div className="text-[11px] text-txt-3 mb-4">
            Currently using <span className="font-bold capitalize">{theme}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map((t) => {
              const active = theme === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={[
                    'flex flex-col gap-2 rounded-lg border p-2 cursor-pointer transition-all bg-transparent text-left',
                    active ? 'border-purple ring-1 ring-purple/40' : 'border-border hover:border-border2',
                  ].join(' ')}
                >
                  {/* Mini preview */}
                  <div
                    className="w-full rounded overflow-hidden flex flex-col"
                    style={{ background: t.bg, height: 48, border: `1px solid ${t.border}` }}
                  >
                    {/* Fake sidebar strip */}
                    <div className="flex h-full">
                      <div style={{ background: t.surface, width: 14, borderRight: `1px solid ${t.border}` }} />
                      <div className="flex-1 flex flex-col gap-1 p-1.5">
                        {/* Fake cards */}
                        <div style={{ background: t.surface, borderRadius: 2, height: 8, width: '80%', opacity: 0.9 }} />
                        <div style={{ background: t.surface, borderRadius: 2, height: 8, width: '55%', opacity: 0.7 }} />
                        <div style={{ color: t.text, fontSize: 7, fontFamily: 'monospace', opacity: 0.85, marginTop: 2 }}>
                          Aa
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Label row */}
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[10px] font-bold font-mono text-txt capitalize">{t.label}</span>
                    {active && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-4">API Keys</p>

      {isLoading && (
        <div className="flex items-center gap-2 text-txt-3 text-[11px]">
          <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
          Loading settings…
        </div>
      )}
      {isError && (
        <div className="text-red text-[13px] mb-4">
          Could not load settings. Is the backend running?
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {FIELDS.map(({ key, label, hint, sensitive }) => {
          const isConfigured = sensitive && loadedMasked.current[key] && isMasked(form[key])
          return (
            <div key={key}>
              <label className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 block mb-[5px] uppercase">
                <span className="flex items-center gap-2">
                  {label}
                  {isConfigured && (
                    <span className="text-[11px] font-bold tracking-[0.08em] px-1.5 py-[2px] rounded border border-green/40 text-green leading-none">
                      CONFIGURED
                    </span>
                  )}
                </span>
              </label>
              <div className="relative">
                <input
                  type={sensitive && !showKeys[key] ? 'password' : 'text'}
                  value={form[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full bg-bg border border-border rounded-md text-txt font-mono text-[11px] px-3 py-2 outline-none focus:border-purple transition-colors pr-16"
                  placeholder={sensitive ? '••••••••••••••••' : label}
                  autoComplete="off"
                />
                {sensitive && (
                  <button
                    type="button"
                    onClick={() => toggleShow(key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-txt-3 hover:text-txt-2 font-bold uppercase tracking-wider bg-transparent border-none cursor-pointer"
                  >
                    {showKeys[key] ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-txt-3 mt-1 leading-relaxed">
                {isConfigured ? 'Clear this field and enter a new key to replace it. ' : ''}{hint}
              </p>
            </div>
          )
        })}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-[10px] text-[11px] font-bold tracking-[0.1em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-50 transition-opacity hover:opacity-90"
          >
            {mutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && (
            <span className="text-[11px] text-green font-bold">Saved.</span>
          )}
          {mutation.isError && (
            <span className="text-[11px] text-red">
              {mutation.error instanceof Error ? mutation.error.message : 'Save failed.'}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
