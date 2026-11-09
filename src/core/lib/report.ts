import * as Sentry from "@sentry/react"
import { toast } from "sonner"

// Sólo en el build de prod con DSN (Vercel): `pnpm dev`, e2e y tests no reportan.
// Sin tracing ni Replay a propósito — ver .scratch/web-metrics/spec.md → Decisiones.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!import.meta.env.PROD || !dsn) return
  Sentry.init({
    dsn,
    // Equivalente v11 de `sendDefaultPii: false`. Los defaults de `dataCollection` son `true`:
    // sin esto viajan los bodies de los POST a Supabase = contenido de notas.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] },
    // Red, no bug: Chrome / Firefox / Safari iOS. El toast sigue avisando.
    ignoreErrors: [/Failed to fetch/, /NetworkError/, /Load failed/],
  })
}

// Toda mutation que falla avisa con el mensaje real de Supabase y se reporta.
export function onMutationError(e: Error) {
  Sentry.captureException(e)
  toast.error(e.message)
}
