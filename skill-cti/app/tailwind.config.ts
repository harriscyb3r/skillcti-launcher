import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      'var(--bg)',
        surface: 'var(--surface)',
        surface2:'var(--surface2)',
        border:  'var(--border)',
        border2: 'var(--border2)',
        purple: {
          DEFAULT: '#a855f7',
          dark: '#7c3aed',
        },
        cyan:  '#06b6d4',
        txt: {
          DEFAULT: 'var(--txt)',
          2: 'var(--txt2)',
          3: 'var(--txt3)',
        },
        red:   '#ef4444',
        amber: '#f59e0b',
        green: '#22c55e',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        card:     'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      borderColor: {
        DEFAULT: '#1a1a2a',
      },
    },
  },
  plugins: [],
} satisfies Config
