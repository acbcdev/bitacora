# Presupuesto de bundle en CI

Status: ready-for-agent
Blocked by: 01

## Qué

Paso en `.github/workflows/ci.yml` (hoy CI no corre `pnpm build`) que buildea y falla si algún
número supera su presupuesto gzip. Script de shell de pocas líneas, sin plugin de Vite.

Dos números:

- **Carga inicial:** suma gz del `<script src>` + todos los `<link rel="modulepreload">` de
  `dist/index.html`. No glob por prefijo: rolldown reparte la entrada en chunks compartidos
  (`store-*`, `textarea-*`, `snapshot-*`) y un budget sobre `index-*` solo no los ve.
- **`note-body-*`** (tiptap, lazy).

Límite = medido **con Sentry dentro** (lo anota 01) + ~15%. Pre-Sentry (2026-11-08): carga inicial
~332 KB gz (`index` 121 + `store` 71 + `textarea` 107 + `snapshot` 32), `note-body` 355 KB gz.

Con Sentry (01, 2026-11-08, `gzip -6`, KB = 1000): carga inicial **360 KB gz** (`index` 151 + `store` 70
+ `textarea` 106 + `snapshot` 32 + `check` 0.4), `note-body` **350 KB gz**. Sentry = ~27 KB en `index`.

**Ojo:** el build de CI tiene que correr con un `VITE_SENTRY_DSN` dummy
(`https://x@o0.ingest.us.sentry.io/0`). Sin DSN, Vite inlinea `undefined`, el guard de `initSentry`
queda muerto y tree-shaking saca `Sentry.init`: index pesa 124, no 151 — el budget mediría un build
que no es el de prod. Lo mismo con `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` dummy: sin
ellos tree-shaking saca supabase-js y `store-*` pesa 18, no 70.

## Aceptación

- CI rojo si se pasa del presupuesto; el mensaje dice cuánto y cuál es el límite.
- Número del presupuesto vive en un solo lugar.
