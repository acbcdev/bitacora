v# 01 — Init del proyecto + Supabase + magic link

Status: ready-for-agent

Bootstrap del repo. Deja la app corriendo, tipada contra el schema, con login por magic link.

## Pasos de inicialización

```bash
# 1. App base (React + TS + Vite)
pnpm create vite@latest . --template react-ts

# 2. Deps de runtime
pnpm add @supabase/supabase-js @tanstack/react-query react-router-dom

# 3. Styling: Tailwind (v4, plugin de Vite) + shadcn/ui
pnpm add tailwindcss @tailwindcss/vite
pnpm dlx shadcn@latest init          # copia componentes al repo, no es dep opaca

# 4. Dev deps
pnpm add -D vite-plugin-pwa vitest
```

- **Alias `@/`** en `vite.config.ts` y `tsconfig.json` (lo exige shadcn/ui, ADR 0005).
- **PWA:** registrar `vite-plugin-pwa` en `vite.config.ts`.
- **Providers:** envolver la app en `QueryClientProvider` (TanStack Query) + el router
  (React Router). Ver ADR 0005.

## Supabase + auth

```bash
# Proyecto creado en el dashboard. Tras crear el schema (issue 02):
supabase gen types typescript --project-id <id> > src/types/database.ts
```

- Cliente: `createClient<Database>(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` — tipado, sin ORM
  (ADR 0006).
- Auth **magic link** habilitado en el dashboard (Authentication → default, sin código propio).
- Flujo mínimo de login: email → magic link → sesión.

## Entorno / seguridad

- `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- `.env` en `.gitignore` **antes del primer commit**.

## Aceptación

- `pnpm dev` levanta la app; `pnpm dlx shadcn@latest add button` resuelve el alias `@/`;
  `pnpm vitest` corre.
- La `anon key` es la única key en el cliente. La `service_role key` no aparece en el repo.
- `src/types/database.ts` existe y `.from('...')` está tipado (tras issue 02).
- Con sesión iniciada, `auth.uid()` disponible para las queries.

## Nota de orden

`supabase gen types` necesita el schema ya creado → correrlo **después** del issue 02. El resto
del init no depende de nada.
