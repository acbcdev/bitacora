# Sentry: errores de prod visibles

Status: ready-for-agent

## Qué

`@sentry/react` + `@sentry/vite-plugin`. Config mínima, ver `spec.md` → Decisiones.

- `Sentry.init` en `src/main.tsx` solo si `import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN`.
  Sin integrations extra (sin Replay, sin tracing), `sendDefaultPii: false`.
- `createRoot(el, { onCaughtError: Sentry.reactErrorHandler(), onUncaughtError: Sentry.reactErrorHandler() })`.
- `MutationCache.onError`: `Sentry.captureException(e)` junto al `toast` existente.
- `vite.config.ts`: `build.sourcemap: true` + `sentryVitePlugin` (no-op sin `SENTRY_AUTH_TOKEN`).
- `VITE_SENTRY_DSN` en `.env.example`.

## Aceptación

- `pnpm build` sin token pasa igual que hoy.
- `pnpm dev` y e2e no inicializan Sentry.
- Un throw en render dentro del `ErrorBoundary` llega a Sentry con stack de fuente (no minificado).
- Una mutation fallida llega a Sentry y sigue mostrando el toast.
- Anotar en `03` el tamaño gz de `index-*` y `note-body-*` con Sentry dentro.

## Manual (humano)

Crear proyecto en Sentry; cargar `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
`SENTRY_PROJECT` en las env vars de Cloudflare Pages.
