# ADR 0001 — Supabase como backend (sobre Turso / D1 / VPS / SQLite local)

**Status:** Accepted

## Contexto

App PWA de estudio, solo-dev, sin servidores propios, costo $0. Necesita: persistencia,
autenticación de un solo usuario, y aislamiento de datos por usuario. Se evaluaron alternativas
de storage y de backend.

## Decisión

Usar **Supabase** (Postgres + Auth + Row Level Security).

## Por qué, contra las alternativas

- **Turso / Cloudflare D1:** ninguno trae auth. Turso accedido desde el browser expondría el
  token = **la DB entera comprometida**. Supabase gana porque auth + RLS dan **cero backend
  propio**: el cliente habla directo a Postgres y RLS (`auth.uid() = user_id`) hace cumplir el
  aislamiento.
- **VPS / servidor propio:** rechazado explícitamente por el usuario. Contradice el objetivo $0
  y sin-ops.
- **SQLite local / Dexie / IndexedDB:** muertos al elegir un backend hosted. No hay sync ni
  multi-device sin construir un sync engine (ver ADR 0004).
- **Electron:** 150MB para envolver una web app sin razón en 2026.

## Consecuencias

- El aislamiento de datos depende 100% de RLS bien escrito. RLS es un requisito, no un extra.
- La `anon key` es pública por diseño (protegida por RLS). La `service_role key` nunca toca el
  cliente ni el repo.
- Free tier: 500MB (sobra 100×), 50k MAU, pausa tras 7 días sin uso (no-issue en app diaria).
- Se acepta el lock-in a Supabase/Postgres. Aceptable: el schema es estándar y portable.
