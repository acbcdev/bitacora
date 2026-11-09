import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"
import { LucideProvider } from "lucide-react"
import * as Sentry from "@sentry/react"
import { App } from "@/app"
import { ErrorBoundary } from "@/core/components/error-boundary"
import { initSentry, initWebAnalytics, onMutationError } from "@/core/lib/report"
import "@/index.css"

initSentry()
initWebAnalytics()

// El onError de mutations va acá y no hook por hook: son seis mutations y ninguna necesita
// un mensaje propio.
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: onMutationError,
  }),
})

// Hooks de React 19: cubren todos los boundaries desde un lugar (el ErrorBoundary atrapa y
// window.onerror nunca lo ve). Sin init, Sentry es no-op.
createRoot(document.getElementById("root")!, {
  onCaughtError: Sentry.reactErrorHandler(),
  onUncaughtError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Iconos del DS: 16px, stroke 1.5. Se setea una vez acá y no en cada <Icon />. */}
        <LucideProvider size={16} strokeWidth={1.5}>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </LucideProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
