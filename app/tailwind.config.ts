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
      keyframes: {
        toastIn: {
          '0%':   { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Drawer/panel entrance — slides in from right with spring deceleration
        drawerIn: {
          '0%':   { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Scrim fade for drawer backdrops
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // Card/section entrance — rises 6px, used with animation-delay for stagger
        cardEnter: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Command palette entrance — scale + slight upward rise
        paletteIn: {
          '0%':   { opacity: '0', transform: 'scale(0.96) translateY(-6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        toastIn:   'toastIn 0.18s ease-out forwards',
        drawerIn:  'drawerIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        fadeIn:    'fadeIn 0.15s ease-out forwards',
        cardEnter: 'cardEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        paletteIn: 'paletteIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [],
} satisfies Config
