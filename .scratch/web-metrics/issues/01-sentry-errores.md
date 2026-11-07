# Sentry: errores de prod visibles

Status: ready-for-agent

## Qué

`@sentry/react` + `@sentry/vite-plugin`. Config mínima, ver `spec.md` → Decisiones.

- `Sentry.init` en `src/main.tsx` solo si `import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN`.
  Sin integrations extra (sin Replay, sin tracing), `sendDefaultPii: false`,
  `ignoreErrors: [/Failed to fetch/, /NetworkError/, /Load failed/]`.
- `createRoot(el, { onCaughtError: Sentry.reactErrorHandler(), onUncaughtError: Sentry.reactErrorHandler() })`.
- `MutationCache.onError`: `Sentry.captureException(e)` junto al `toast` existente.
- `useSnapshot` (`src/core/lib/snapshot.ts`): `throwOnError: (_, q) => q.state.status === "success"`
  — solo errores de `select` (`derive.*`) suben al boundary; los de fetch no.
- `vite.config.ts`: `build.sourcemap: true` + `sentryVitePlugin` (no-op sin `SENTRY_AUTH_TOKEN`).
- `VITE_SENTRY_DSN` en `.env.example`.

## Aceptación

- `pnpm build` sin token pasa igual que hoy.
- `pnpm dev` y e2e no inicializan Sentry.
- Un throw en render dentro del `ErrorBoundary` llega a Sentry con stack de fuente (no minificado).
- Una mutation fallida (no de red) llega a Sentry y sigue mostrando el toast.
- Un error de red (`Failed to fetch`) en una mutation muestra el toast y **no** llega a Sentry.
- Test unitario: un `select` que tira renderiza el fallback del `ErrorBoundary`; un `queryFn` que
  falla no lo hace.
- Anotar en `03` el tamaño gz de `index-*` y `note-body-*` con Sentry dentro.

## Manual (humano)

Crear proyecto en Sentry; cargar `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
`SENTRY_PROJECT` en las env vars de Cloudflare Pages.
