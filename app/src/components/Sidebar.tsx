import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Zap, Newspaper, Target, Users,
  ScanSearch, ShieldAlert, HelpCircle, MessageSquare,
  Folder, FileText, BookOpen, BookMarked, Eye,
  Clock, CalendarClock, Settings, Search, Sun, Moon, Bell,
  ShieldOff, Database, Briefcase, Skull, ScrollText, Crosshair,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import StatusDot from './StatusDot'
import { useTheme } from '../lib/theme'
import { api } from '../lib/api'
import { useUnreadNotificationCount } from '../lib/useToast'

const ICON_SIZE = 16
const ICON_STROKE = 1.75

const NAV_GROUPS: { label: string | null; items: { label: string; to: string; Icon: LucideIcon }[] }[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard', to: '/dashboard', Icon: LayoutDashboard },
      { label: 'Skills',    to: '/skills',    Icon: Zap },
      { label: 'Analyst',   to: '/analyst',   Icon: MessageSquare },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'News',   to: '/feeds',  Icon: Newspaper },
      { label: 'ATT&CK', to: '/attack', Icon: Target },
      { label: 'Actors',     to: '/actors',     Icon: Users },
      { label: 'Ransomware', to: '/ransomware', Icon: Skull },
      { label: 'MISP',       to: '/misp',       Icon: Database },
    ],
  },
  {
    label: 'Investigate',
    items: [
      { label: 'IOC Lookup',   to: '/ioc-search',           Icon: ScanSearch },
      { label: 'CVE Search',   to: '/cve-search',           Icon: ShieldAlert },
      { label: 'Credentials',  to: '/credential-exposure',  Icon: ShieldOff },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Clients',    to: '/clients',   Icon: Briefcase },
      { label: 'PIR',        to: '/pir',       Icon: HelpCircle },
      { label: 'Cases',      to: '/cases',     Icon: Folder },
      { label: 'Hunts',      to: '/hunts',     Icon: Crosshair },
      { label: 'Reports',    to: '/reports',   Icon: FileText },
      { label: 'Library',        to: '/library',        Icon: BookOpen },
      { label: 'Prompt Library', to: '/prompt-library', Icon: ScrollText },
      { label: 'Reference',      to: '/reference',      Icon: BookMarked },
      { label: 'Monitoring', to: '/watchlist', Icon: Eye },
    ],
  },
  {
    label: 'Automation',
    items: [
      { label: 'Jobs',      to: '/jobs',      Icon: Clock },
      { label: 'Schedules', to: '/schedules', Icon: CalendarClock },
    ],
  },
  {
    label: null,
    items: [
      { label: 'Settings', to: '/settings', Icon: Settings },
    ],
  },
]

export default function Sidebar({ onOpenSearch, onOpenNotif }: { onOpenSearch?: () => void; onOpenNotif?: () => void }) {
  const { theme, toggleDarkLight } = useTheme()

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  )

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('sidebar-groups') ?? '{}') } catch { return {} }
  })

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  function toggleGroup(label: string) {
    setCollapsedGroups(prev => {
      const next = { ...prev, [label]: !prev[label] }
      localStorage.setItem('sidebar-groups', JSON.stringify(next))
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

  const unread      = alertCount?.unread ?? 0
  const activeJobs  = jobCount?.running ?? 0
  const newsUnread  = newsCount?.unread ?? 0
  const notifUnread = useUnreadNotificationCount()

  // "New report" pip — lights up when a running job finishes, clears on /reports visit
  const [hasNewReport, setHasNewReport] = useState(false)
  const prevActiveJobsRef = useRef(activeJobs)
  const location = useLocation()

  useEffect(() => {
    if (prevActiveJobsRef.current > 0 && activeJobs === 0) {
      setHasNewReport(true)
    }
    prevActiveJobsRef.current = activeJobs
  }, [activeJobs])

  useEffect(() => {
    if (location.pathname === '/reports') setHasNewReport(false)
  }, [location.pathname])

  const isMac = navigator.platform.includes('Mac')

  return (
    <aside
      className={[
        'flex flex-col border-r border-border bg-surface flex-shrink-0 h-screen',
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
          <Search size={14} strokeWidth={ICON_STROKE} />
        </button>
      ) : (
        <button
          onClick={onOpenSearch}
          className="mx-3 my-2 flex items-center gap-2 px-3 py-[7px] rounded-lg border border-border text-txt-3 hover:text-txt-2 hover:border-border2 transition-colors bg-transparent cursor-pointer text-left flex-shrink-0"
        >
          <Search size={14} strokeWidth={ICON_STROKE} />
          <span className="flex-1 text-[11px] whitespace-nowrap">Search…</span>
          <kbd className="text-[10px] font-mono text-txt-3 bg-bg/60 px-1 py-0.5 rounded border border-border leading-none whitespace-nowrap">
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 flex flex-col py-1 overflow-y-auto overflow-x-hidden">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && !collapsed && (
              <button
                onClick={() => toggleGroup(group.label!)}
                className="w-full px-[18px] pt-4 pb-1 text-[11px] font-semibold uppercase tracking-widest text-txt-3 flex items-center justify-between hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer"
              >
                {group.label}
                <ChevronDown
                  size={12}
                  strokeWidth={2.5}
                  className={['transition-transform duration-200', collapsedGroups[group.label] ? '-rotate-90' : ''].join(' ')}
                />
              </button>
            )}
            {group.label && collapsed && gi > 0 && (
              <div className="mx-auto my-2 w-5 border-t border-border" />
            )}
            {(!group.label || !collapsedGroups[group.label] || collapsed) && group.items.map((item) => {
              const hasBadge =
                (item.to === '/watchlist' && unread > 0) ||
                (item.to === '/feeds'     && newsUnread > 0) ||
                (item.to === '/jobs'      && activeJobs > 0) ||
                (item.to === '/reports'   && hasNewReport)

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
                  <item.Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} className="flex-shrink-0" />

                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}

                  {/* Full badges (expanded) */}
                  {!collapsed && item.to === '/watchlist' && unread > 0 && (
                    <span className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red text-white leading-none min-w-[16px] text-center">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                  {!collapsed && item.to === '/feeds' && newsUnread > 0 && (
                    <span className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-purple/20 text-purple leading-none min-w-[16px] text-center">
                      {newsUnread > 99 ? '99+' : newsUnread}
                    </span>
                  )}
                  {!collapsed && item.to === '/jobs' && activeJobs > 0 && (
                    <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-purple leading-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple animate-pulse" />
                      {activeJobs}
                    </span>
                  )}
                  {!collapsed && item.to === '/reports' && hasNewReport && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green/15 text-green leading-none">
                      new
                    </span>
                  )}

                  {/* Dot-only badges (collapsed) */}
                  {collapsed && hasBadge && (
                    <span
                      className={[
                        'absolute top-[7px] right-[9px] w-[6px] h-[6px] rounded-full',
                        item.to === '/jobs'     ? 'bg-purple animate-pulse'
                        : item.to === '/watchlist' ? 'bg-red'
                        : item.to === '/reports'   ? 'bg-green'
                        : 'bg-purple',
                      ].join(' ')}
                    />
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
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
          {theme === 'light'
            ? <Moon size={13} strokeWidth={ICON_STROKE} />
            : <Sun  size={13} strokeWidth={ICON_STROKE} />
          }
        </button>

        {/* Notifications bell */}
        <button
          onClick={onOpenNotif}
          title="Notifications"
          className="relative text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer p-1.5 rounded flex-shrink-0"
        >
          <Bell size={13} strokeWidth={ICON_STROKE} />
          {notifUnread > 0 && (
            <span className="absolute top-0.5 right-0.5 w-[7px] h-[7px] rounded-full bg-purple" />
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer p-1.5 rounded flex-shrink-0"
        >
          {collapsed
            ? <ChevronRightIcon size={13} strokeWidth={2.5} />
            : <ChevronLeftIcon  size={13} strokeWidth={2.5} />
          }
        </button>
      </div>
    </aside>
  )
}
