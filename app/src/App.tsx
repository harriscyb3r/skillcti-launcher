import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'

const Dashboard    = lazy(() => import('./pages/Dashboard'))
const Skills       = lazy(() => import('./pages/Skills'))
const Reports      = lazy(() => import('./pages/Reports'))
const Settings     = lazy(() => import('./pages/Settings'))
const IOCSearch    = lazy(() => import('./pages/IOCSearch'))
const CVESearch    = lazy(() => import('./pages/CVESearch'))
const Analyst      = lazy(() => import('./pages/Analyst'))
const Monitoring   = lazy(() => import('./pages/Monitoring'))
const JobsPanel    = lazy(() => import('./pages/JobsPanel'))
const Library      = lazy(() => import('./pages/Library'))
const Feeds        = lazy(() => import('./pages/Feeds'))
const Attack       = lazy(() => import('./pages/Attack'))
const ThreatActors = lazy(() => import('./pages/ThreatActors'))
const Schedules    = lazy(() => import('./pages/Schedules'))
const Cases        = lazy(() => import('./pages/Cases'))
const PIR          = lazy(() => import('./pages/PIR'))
const Reference    = lazy(() => import('./pages/Reference'))
const CredentialExposure  = lazy(() => import('./pages/CredentialExposure'))
const MISP                = lazy(() => import('./pages/MISP'))
const Clients             = lazy(() => import('./pages/Clients'))
const RansomwareTracker   = lazy(() => import('./pages/RansomwareTracker'))
const PromptLibrary       = lazy(() => import('./pages/PromptLibrary'))
const Hunts               = lazy(() => import('./pages/Hunts'))

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
          <Route path="malware-intel" element={<Navigate to="/ioc-search" replace />} />
          <Route path="cve-search" element={<CVESearch />} />
          <Route path="analyst" element={<Analyst />} />
          <Route path="watchlist" element={<Monitoring />} />
          <Route path="domain-enum" element={<Navigate to="/ioc-search?tab=domain" replace />} />
          <Route path="jobs" element={<JobsPanel />} />
          <Route path="library" element={<Library />} />
          <Route path="feeds" element={<Feeds />} />
          <Route path="attack" element={<Attack />} />
          <Route path="actors" element={<ThreatActors />} />
          <Route path="schedules" element={<Schedules />} />
          <Route path="cases" element={<Cases />} />
          <Route path="pir" element={<PIR />} />
          <Route path="reference" element={<Reference />} />
          <Route path="credential-exposure" element={<CredentialExposure />} />
          <Route path="misp" element={<MISP />} />
          <Route path="clients" element={<Clients />} />
          <Route path="ransomware" element={<RansomwareTracker />} />
          <Route path="prompt-library" element={<PromptLibrary />} />
          <Route path="hunts" element={<Hunts />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
