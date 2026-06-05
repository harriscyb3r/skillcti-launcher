import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Return index.html for browser navigation so React Router handles the route.
// Without this, any proxy rule whose prefix matches a React route will forward
// the GET to FastAPI and get back 405 (POST-only endpoints) or 404.
function spa(req: { headers: { accept?: string } }) {
  if (req.headers.accept?.includes('text/html')) return '/index.html'
}

const BE = 'http://localhost:8765'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health':          BE,
      '/reports':         { target: BE, bypass: spa },
      '/skill/':          BE,
      '/generate-pdf':    BE,
      '/generate-pptx':   BE,
      '/ransomware-au':   BE,
      '/ransomware-feed': BE,
      '/chat/':           BE,
      '/enrich':          BE,
      '/cve':             { target: BE, bypass: spa },
      '/domain-enum':     { target: BE, bypass: spa },
      '/v1':              BE,
      '/api':             BE,
    },
  },
})
