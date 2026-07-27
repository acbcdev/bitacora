# CONTEXT — pulpo

App personal de gestión de estudio. El usuario toma notas de cursos (hoy en Notion) y necesita
trackear progreso, repasar a diario y sentir la interfaz **rápida** (shortcuts, poco mouse).

Este archivo es la fuente de verdad del dominio. Los agentes deben usar **este vocabulario**
(no sinónimos) en títulos de issues, tests, nombres de módulos y refactors.

## Problema que resuelve

Notion sirve para **escribir**, pero no para:

- Trackear cuándo empezó un curso, cuánto tardó, cuál está pausado/abandonado.
- Contar repasos por nota (hoy se lleva a mano).
- Tener una cola de "qué leo hoy" (hábito: 2–3 notas/día).
- Sentirse rápido — Notion es mucho mouse, pocos shortcuts.

## Escala (define las decisiones técnicas)

- **59 cursos × ~25 notas ≈ 1.500 notas.** Crecimiento lento: una nota por clase.
- **Los datos son CHICOS.** Sin FTS, sin scoring, sin índices exóticos. Cualquier propuesta que
  asuma volumen grande está mal calibrada para este proyecto.

## Stack (cerrado)

Vite + React + **Tiptap** (editor WYSIWYG, licencia MIT) + **Supabase** (Postgres + Auth + RLS)
→ **PWA** en Cloudflare Pages. Costo $0, sin servidores propios.

Nivel medio (ver `docs/adr/0005-frontend-stack.md`):

- **Routing:** React Router · **Data/estado servidor:** TanStack Query · **Styling:** Tailwind +
  Radix vía **shadcn/ui** · **PWA:** `vite-plugin-pwa` · **Testing:** Vitest · **pm:** pnpm.
- **Acceso a datos:** `supabase-js` + tipos generados (`supabase gen types`). **Sin ORM**
  (ADR 0006) — un ORM no tiene dónde correr sin backend y bypassa RLS.
- **Sin design system formal.** Las guías visuales viven en `docs/ui-principles.md`
  (keyboard-first, nota grande, chrome mínimo).

Notas de licencia/tier:

- **Supabase free tier:** 500MB DB (sobra 100× para ~1.500 notas markdown), 50k MAU. Se pausa a
  los 7 días sin actividad — no-issue en una app de uso diario.
- **Tiptap:** el editor es MIT y gratis para siempre. Tiptap Cloud (colaboración, comentarios, AI,
  hosting) es lo pago — **nada de eso se usa acá**.

## Glosario

| Término | Definición |
|---|---|
| **Course** | Un curso. Tiene `status` (`active` / `paused` / `done`), `started_at`, `finished_at`. |
| **Note** | Una nota dentro de un curso. `content` es el documento Tiptap. `position` la ordena. |
| **read_log** | Registro histórico de cada repaso: una fila `(note_id, read_at)` por lectura. **Nunca se borra.** |
| **Progreso derivado** | `notas leídas / total del curso`. No se guarda: sale de `COUNT(*)` sobre `read_log`. |
| **read_count** | Cuántas veces se repasó una nota. Derivado de `read_log`. |
| **Racha / leídas hoy** | Derivados de `read_log` filtrando por fecha. |
| **Cola de repaso** | Notas de cursos `active`, ordenadas por `max(read_at)` ascendente (las más viejas primero). |
| **Soft delete** | Borrado lógico vía `deleted_at`. La app **nunca** hace `DELETE`. Toda query filtra `deleted_at is null`. |
| **flag `imported`** | Marca notas/cursos migrados de Notion cuyas fechas son estimadas (`created_time` como aprox. de `started_at`). |

## Schema (frozen)

```sql
courses(id, user_id, name, status, started_at, finished_at, icon, deleted_at, created_at)
  -- status: 'active' | 'paused' | 'done'
  -- icon: 'lucide:<Nombre>' (preset) o URL pública del bucket 'course-icons'. Nullable.
notes(id, user_id, course_id, title, content, position, deleted_at, created_at)
  -- content: documento Tiptap. course_id uuid references courses(id) on delete set null
read_log(id, user_id, note_id, read_at)
```

- RLS en las 3 tablas: `auth.uid() = user_id`.
- Todo derivado, nada denormalizado. Ver `docs/adr/0003-derive-everything-from-read-log.md`.

## Las 3 pantallas (y solo 3)

1. **Repaso** — la que abre 2–3×/día. Nota grande. `Space` = marcar leído (insert en `read_log`)
   + siguiente. `J`/`K` = saltar sin contar.
2. **Cursos** — lista con estado, progreso derivado, fechas.
3. **Nota** — editor Tiptap.

**Auth:** magic link (default de Supabase, cero código).

## Fuera del MVP (decisión explícita, no olvido)

`goals`/metas · stats y gráficos · búsqueda · tags · offline-first · sync engine.

`goals` se diseñó y descartó a propósito: se mira 1×/semana, es una tabla + CRUD de 2h **después**
de que el loop diario ande. Si vuelve el impulso hacia sync/stats/goals antes de que el loop
diario funcione, es **scope creep** — frenarlo con estos datos, no con opinión.

## Seguridad

- La `anon key` va en `.env` (es pública por diseño, protegida por RLS).
- La `service_role key` **nunca** en el cliente ni en el repo.
- `.gitignore` con `.env` desde el primer commit.

## Decisiones

Las grandes están en `docs/adr/`. El resto (Editor.js, CodeMirror, Electron, Obsidian plugin,
VPS, SQLite/Dexie local) fueron descartadas y no se reabren sin razón nueva — el porqué vive en
los specs de cada feature bajo `.scratch/`.
