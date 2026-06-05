import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import StatusDot from './StatusDot'
import { useTheme } from '../lib/theme'
import { api } from '../lib/api'

const NAV = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Skills',
    to: '/skills',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    label: 'Analyst',
    to: '/analyst',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: 'CVE Search',
    to: '/cve-search',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    label: 'IOC Search',
    to: '/ioc-search',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
  {
    label: 'Bulk Enrich',
    to: '/bulk-enrich',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <rect x="3" y="3" width="7" height="4" rx="1" />
        <rect x="3" y="10" width="7" height="4" rx="1" />
        <rect x="3" y="17" width="7" height="4" rx="1" />
        <line x1="14" y1="5" x2="21" y2="5" />
        <line x1="14" y1="12" x2="21" y2="12" />
        <line x1="14" y1="19" x2="21" y2="19" />
      </svg>
    ),
  },
  {
    label: 'Malware Intel',
    to: '/malware-intel',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    label: 'Domain Enum',
    to: '/domain-enum',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    label: 'Breach Monitor',
    to: '/breach-monitor',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <path d="M20 13c0 5-3.5 7.5-8 8.5C7.5 20.5 4 18 4 13V6l8-3 8 3v7z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'ATT&CK',
    to: '/attack',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    label: 'Actors',
    to: '/actors',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'News',
    to: '/feeds',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
      </svg>
    ),
  },
  {
    label: 'Library',
    to: '/library',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    label: 'Cases',
    to: '/cases',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    to: '/reports',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    label: 'Watchlist',
    to: '/watchlist',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    label: 'Jobs',
    to: '/jobs',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: 'Schedules',
    to: '/schedules',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <polyline points="8 14 10 16 16 14" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

// Icon-only search icon
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

// Chevron icons for collapse toggle
const ChevronLeft = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const ChevronRight = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

export default function Sidebar({ onOpenSearch }: { onOpenSearch?: () => void }) {
  const { theme, toggleDarkLight } = useTheme()

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  )

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  const { data: alertCount } = useQuery({
    queryKey: ['alert-count'],
    queryFn: api.getAlertCount,
    refetchInterval: 30_000,
    retry: false,
  })

  const { data: jobCount } = useQuery({
    queryKey: ['active-job-count'],
    queryFn: api.getActiveJobCount,
    refetchInterval: 3_000,
    retry: false,
  })

  const { data: newsCount } = useQuery({
    queryKey: ['news-unread-count'],
    queryFn: api.getNewsUnreadCount,
    refetchInterval: 60_000,
    retry: false,
  })

  const unread = alertCount?.unread ?? 0
  const activeJobs = jobCount?.running ?? 0
  const newsUnread = newsCount?.unread ?? 0

  const isMac = navigator.platform.includes('Mac')

  return (
    <aside
      className={[
        'flex flex-col border-r border-border bg-gradient-to-b from-surface to-bg flex-shrink-0 h-screen',
        'transition-[width] duration-200 ease-in-out overflow-x-hidden',
        collapsed ? 'w-14' : 'w-[230px]',
      ].join(' ')}
    >
      {/* ── Header ── */}
      <div
        className={[
          'border-b border-border flex items-center flex-shrink-0 min-h-[60px]',
          collapsed ? 'justify-center px-3 py-4' : 'gap-[11px] px-[18px] py-4',
        ].join(' ')}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple to-cyan flex items-center justify-center p-[3px] flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" className="w-full h-full">
            <path d="M12 2L4 6v5.5c0 5 3.5 9.3 8 10.5 4.5-1.2 8-5.5 8-10.5V6L12 2z" />
            <circle cx="12" cy="11" r="3" />
            <line x1="12" y1="6.5" x2="12" y2="8" />
            <line x1="12" y1="14" x2="12" y2="15.5" />
            <line x1="7.5" y1="11" x2="9" y2="11" />
            <line x1="15" y1="11" x2="16.5" y2="11" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <div className="text-[14px] font-bold text-txt tracking-[0.07em] uppercase whitespace-nowrap">SkillCTI</div>
            <div className="text-[11px] text-txt-3 mt-0.5 whitespace-nowrap">Threat Intelligence</div>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      {collapsed ? (
        <button
          onClick={onOpenSearch}
          title={`Search (${isMac ? '⌘K' : 'Ctrl+K'})`}
          className="mx-auto my-2 w-9 h-9 flex items-center justify-center rounded-lg border border-border text-txt-3 hover:text-txt-2 hover:border-border2 transition-colors bg-transparent cursor-pointer flex-shrink-0"
        >
          <SearchIcon />
        </button>
      ) : (
        <button
          onClick={onOpenSearch}
          className="mx-3 my-2 flex items-center gap-2 px-3 py-[7px] rounded-lg border border-border text-txt-3 hover:text-txt-2 hover:border-border2 transition-colors bg-transparent cursor-pointer text-left flex-shrink-0"
        >
          <SearchIcon />
          <span className="flex-1 text-[11px] whitespace-nowrap">Search…</span>
          <kbd className="text-[9px] font-mono text-txt-3 bg-bg/60 px-1 py-0.5 rounded border border-border leading-none whitespace-nowrap">
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 flex flex-col py-1 overflow-y-auto overflow-x-hidden">
        {NAV.map((item) => {
          const hasBadge =
            (item.to === '/watchlist' && unread > 0) ||
            (item.to === '/feeds' && newsUnread > 0) ||
            (item.to === '/jobs' && activeJobs > 0)

          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                [
                  'relative flex items-center border-none border-l-2 transition-all duration-150 w-full',
                  collapsed
                    ? 'justify-center py-[9px] px-0'
                    : 'gap-3 px-[18px] py-[9px] text-[13px]',
                  isActive
                    ? 'text-txt font-semibold border-l-purple bg-purple/[0.08]'
                    : 'font-medium text-txt-2 border-l-transparent hover:text-txt hover:bg-white/[0.04]',
                ].join(' ')
              }
            >
              {item.icon}

              {/* Label — hidden when collapsed */}
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}

              {/* Full badges (expanded) */}
              {!collapsed && item.to === '/watchlist' && unread > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red text-white leading-none min-w-[16px] text-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
              {!collapsed && item.to === '/feeds' && newsUnread > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple/20 text-purple leading-none min-w-[16px] text-center">
                  {newsUnread > 99 ? '99+' : newsUnread}
                </span>
              )}
              {!collapsed && item.to === '/jobs' && activeJobs > 0 && (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-purple leading-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple animate-pulse" />
                  {activeJobs}
                </span>
              )}

              {/* Dot-only badges (collapsed) */}
              {collapsed && hasBadge && (
                <span
                  className={[
                    'absolute top-[7px] right-[9px] w-[6px] h-[6px] rounded-full',
                    item.to === '/jobs' ? 'bg-purple animate-pulse' : item.to === '/watchlist' ? 'bg-red' : 'bg-purple',
                  ].join(' ')}
                />
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Footer ── */}
      <div
        className={[
          'border-t border-border flex-shrink-0 flex items-center gap-1',
          collapsed ? 'flex-col py-3 px-2' : 'px-[14px] py-[11px] justify-between',
        ].join(' ')}
      >
        {!collapsed && <StatusDot />}

        {/* Theme toggle */}
        <button
          onClick={toggleDarkLight}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer p-1.5 rounded flex-shrink-0"
        >
          {theme === 'light' ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer p-1.5 rounded flex-shrink-0"
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>
    </aside>
  )
}
