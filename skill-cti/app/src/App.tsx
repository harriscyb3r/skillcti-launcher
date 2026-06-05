import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Skills from './pages/Skills'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import IOCSearch from './pages/IOCSearch'
import CVESearch from './pages/CVESearch'
import Analyst from './pages/Analyst'
import Watchlist from './pages/Watchlist'
import DomainEnum from './pages/DomainEnum'
import JobsPanel from './pages/JobsPanel'
import BulkEnrich from './pages/BulkEnrich'
import MalwareIntel from './pages/MalwareIntel'
import BreachMonitor from './pages/BreachMonitor'
import Library from './pages/Library'
import Feeds from './pages/Feeds'
import Attack from './pages/Attack'
import ThreatActors from './pages/ThreatActors'
import Schedules from './pages/Schedules'
import Cases from './pages/Cases'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="skills" element={<Skills />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="ioc-search" element={<IOCSearch />} />
          <Route path="bulk-enrich" element={<BulkEnrich />} />
          <Route path="malware-intel" element={<MalwareIntel />} />
          <Route path="cve-search" element={<CVESearch />} />
          <Route path="analyst" element={<Analyst />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="domain-enum" element={<DomainEnum />} />
          <Route path="breach-monitor" element={<BreachMonitor />} />
          <Route path="jobs" element={<JobsPanel />} />
          <Route path="library" element={<Library />} />
          <Route path="feeds" element={<Feeds />} />
          <Route path="attack" element={<Attack />} />
          <Route path="actors" element={<ThreatActors />} />
          <Route path="schedules" element={<Schedules />} />
          <Route path="cases" element={<Cases />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
