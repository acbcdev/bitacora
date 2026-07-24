# Feature: foundation

**Blocked by:** (nada — es la base)

Infra que habilita todo lo demás. No shippea valor de usuario por sí sola, pero sin esto no hay
app. Primero sí o sí.

## Scope

- Proyecto Supabase creado, con **magic link** auth (default, cero código de auth propio).
- Migración inicial: las **3 tablas completas** (`courses`, `notes`, `read_log`) + FK.
- **RLS** en las 3 tablas: `auth.uid() = user_id`.
- Cliente Vite + React que conecta a Supabase con la `anon key` desde `.env`.
- **Scaffolding de frontend** (ADR 0005): React Router, TanStack Query, Tailwind + shadcn/ui
  (con alias `@/` en Vite), `vite-plugin-pwa`, Vitest. pnpm.
- `.gitignore` con `.env` desde el primer commit.

Ver `CONTEXT.md` para el schema completo, y `docs/adr/0001` (Supabase) y `0002` (soft delete / FK).

## Por qué el schema entero acá y no tabla-por-feature

El schema está **cerrado** (frozen en CONTEXT.md), son 3 tablas con FK cruzada
(`notes.course_id → courses`). Splitear un schema cerrado entre features es ceremonia y agrega
orden-de-dependencia frágil entre migraciones. Una migración inicial y listo. Los otros features
asumen tablas existentes y solo escriben queries + UI.

## Fuera de scope

- Cualquier UI de negocio (cursos, notas, repaso) — eso es de los otros features.
- Cleanup de soft-deletes (manual, vía SQL editor, ADR 0002).

## Seguridad (no negociable)

- `anon key` en `.env` (pública por diseño, protegida por RLS).
- `service_role key` **nunca** en cliente ni repo.
- `.env` en `.gitignore` desde el commit inicial.

## Issues

- `01` proyecto Supabase + magic link + `.env` / `.gitignore`
- `02` migración schema (3 tablas + FK)
- `03` RLS policies
