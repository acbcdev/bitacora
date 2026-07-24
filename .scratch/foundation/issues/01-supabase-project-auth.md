# 01 — Proyecto Supabase + magic link + scaffolding

Status: ready-for-agent

## Qué

- Crear proyecto Supabase.
- Habilitar auth por **magic link** (default de Supabase, sin código de auth propio).
- App base Vite + React que inicializa el cliente Supabase con `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_ANON_KEY` desde `.env`.
- Flujo mínimo de login: pedir email → magic link → sesión.
- **Scaffolding de frontend** (ADR 0005): React Router, provider de TanStack Query,
  Tailwind + `shadcn/ui` init (alias `@/` en `vite.config`), `vite-plugin-pwa`, Vitest. pnpm.

## Aceptación

- `.env` existe, `.env` está en `.gitignore` **antes del primer commit**.
- La `anon key` es la única key en el cliente. La `service_role key` no aparece en el repo.
- Con la sesión iniciada, `auth.uid()` está disponible para las queries.
- `pnpm dev` levanta la app; `shadcn add <componente>` funciona (alias resuelto); Vitest corre.
