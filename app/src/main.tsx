import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query'
import App from './App'
import { initTheme } from './lib/theme'
import { toast } from './lib/useToast'
import './index.css'

initTheme()

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      toast(error instanceof Error ? error.message : 'Operation failed', 'error')
    },
  }),
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only toast on background refetch failures, not on initial load
      // (initial load errors are shown inline via isError state)
      if (query.state.dataUpdateCount > 0) {
        toast(error instanceof Error ? error.message : 'Failed to refresh data', 'error')
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
