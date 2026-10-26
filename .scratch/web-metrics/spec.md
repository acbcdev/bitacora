# Web metrics (errores + rendimiento + no regresionar)

**Status:** grilled 2026-10-26 (`/grill-with-docs`). Borrador original 2026-10-08.

## Origen

El borrador quería medir para decidir si hacía falta el split por ruta. Ese split se hizo igual en
`0d0b628` (2026-10-10): chunk inicial 595 → 175 KB gz, tiptap aparte. El objetivo cambia a
**ver lo que pasa en prod y no regresionar**.

Punto ciego que el borrador no tenía: **errores**. El repaso es en el celular (ADR 0004); una
excepción ahí hoy es invisible — sin consola, sin log.

## Framing

Second brain personal, **hoy un solo usuario** (ver CONTEXT.md). La dirección es abrirlo a otros,
pero no se instrumenta nada para usuarios que no existen.

## Tres ejes

| Eje         | Herramienta                 | Por qué                                                   |
| ----------- | --------------------------- | --------------------------------------------------------- |
| Errores     | **Sentry** (hosted)         | Source maps + alertas por mail. SDK compatible con GlitchTip: cambiar es el DSN. |
| Rendimiento | **Cloudflare Web Analytics** | Ya hosteamos en CF Pages: toggle, sin cookies, vitals reales del celular. |
| Uso         | `read_log` (ADR 0003)       | PostHog **diferido** hasta que haya un segundo usuario real. |

Más un **budget de bundle en CI** para no regresionar.

## Decisiones

- **Sentry mínimo:** solo error tracking. Sin Replay (grabaría el contenido de las notas), sin
  tracing (duplica CF), `sendDefaultPii: false`. Activo solo si `import.meta.env.PROD` y hay DSN:
  no corre en `pnpm dev` ni en e2e (`localStore`).
- **Dónde capturar** — criterio: reportar lo que es bug o pérdida de datos, no lo que es red.
  - Render: `createRoot(el, { onCaughtError, onUncaughtError })` con `Sentry.reactErrorHandler()`.
    El `ErrorBoundary` atrapa los errores y `window.onerror` nunca los ve; los hooks de React 19
    cubren todos los boundaries desde un lugar.
  - Mutations: `captureException` al lado del `toast` en el `MutationCache` de `main.tsx`.
  - Queries: no (casi siempre red; react-query reintenta).
- **Source maps:** `@sentry/vite-plugin` en el build de Cloudflare Pages (no hay deploy en GitHub
  Actions). Sube solo si existe `SENTRY_AUTH_TOKEN`; sin token no hace nada. El repo es público:
  no hace falta borrar los `.map`.
- **Budget:** chunks `index-*` y `note-body-*`, límite = medido **después** de Sentry + ~15%.
- **Aceptado:** ad-blockers bloquean el envío a sentry.io. Un tunnel requiere endpoint propio
  (contra "sin servidores propios"). Se pierde.

## Issues

1. `01-sentry-errores` — ready-for-agent
2. `02-marks-flujos-propios` — diferido
3. `03-bundle-budget-ci` — ready-for-agent, blocked by 01
4. `04-persistir-metricas` — wontfix
5. `05-cloudflare-web-analytics` — ready-for-human (toggle manual)

## No hacer

- Sin Session Replay, en ninguna herramienta, sin `maskAllText`.
- Sin analytics de uso hasta un segundo usuario real.
- Sin dashboard propio.
