# Sentry: errores de prod visibles

Status: resolved

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
- `VITE_SENTRY_DSN` en `.env.example` **comentado**, con nota: vive solo en Vercel, no en
  `.env` local (si no, `pnpm build && pnpm preview` reporta desde la máquina de dev).

## Aceptación (agente)

- `pnpm build` sin token pasa igual que hoy y deja `dist/assets/*.map`.
- `Sentry.init` no corre sin `PROD` + DSN (`pnpm dev`, e2e, tests).
- Test unitario: un `select` que tira renderiza el fallback del `ErrorBoundary`; un `queryFn` que
  falla no lo hace.
- Test unitario (Sentry mockeado): `MutationCache.onError` llama `captureException` y sigue
  mostrando el toast.
- Anotar en `03` los dos números con Sentry dentro: **carga inicial** (entry + `modulepreload` de
  `dist/index.html`, gz) y `note-body-*` gz.

## Manual (humano)

Crear proyecto en Sentry; cargar `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
`SENTRY_PROJECT` en las env vars de Vercel.

Verificar post-deploy (necesita DSN real, el agente no puede):

- Un throw en render dentro del `ErrorBoundary` llega a Sentry con stack de fuente (no minificado).
- Una mutation fallida (no de red) llega a Sentry y sigue mostrando el toast.
- Un error de red (`Failed to fetch`) en una mutation muestra el toast y **no** llega a Sentry.

## Comments

**2026-11-08 (implement-spec):** resuelto en `web-metrics` (`8635811`, review fixes `1e9b83c`). El
deploy es **Vercel**, no Cloudflare Pages: las env vars van en Vercel. Pendiente humano: la sección
"Manual" de arriba (proyecto Sentry + env vars + verificación post-deploy).
