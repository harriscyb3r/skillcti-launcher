import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light' | 'terminal' | 'slate' | 'mocha' | 'midnight' | 'consulting' | 'cyberpunk'

export const THEMES: { id: Theme; label: string; bg: string; surface: string; text: string; border: string }[] = [
  { id: 'dark',        label: 'Dark',        bg: '#050508', surface: '#0d0d18', text: '#e8e6ff', border: '#1a1a2a' },
  { id: 'light',       label: 'Light',       bg: '#ffffff', surface: '#eaeaef', text: '#1a1a1a', border: '#d4d4da' },
  { id: 'terminal',    label: 'Terminal',    bg: '#000000', surface: '#080808', text: '#00ff41', border: '#1a2e1a' },
  { id: 'slate',       label: 'Slate',       bg: '#0d1117', surface: '#161b22', text: '#e6edf3', border: '#30363d' },
  { id: 'mocha',       label: 'Mocha',       bg: '#1e1e2e', surface: '#28283e', text: '#cdd6f4', border: '#45475a' },
  { id: 'midnight',    label: 'Midnight',    bg: '#060918', surface: '#0c1025', text: '#dce4ff', border: '#1a2545' },
  { id: 'consulting',  label: 'Consulting',  bg: '#f4f6fa', surface: '#00338d', text: '#ffffff', border: '#dde2ee' },
  { id: 'cyberpunk',   label: 'Cyberpunk',   bg: '#05000f', surface: '#0e0020', text: '#ff2d78', border: '#ff0090' },
]

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('skillcti-theme') as Theme | null
    return stored ?? 'dark'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('skillcti-theme', theme)
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
  }

  function toggleDarkLight() {
    setThemeState((current) => (current === 'light' ? 'dark' : 'light'))
  }

  return { theme, setTheme, toggleDarkLight }
}

export function initTheme() {
  const stored = localStorage.getItem('skillcti-theme') as Theme | null
  applyTheme(stored ?? 'dark')
}
