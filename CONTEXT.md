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
| **Habit** | Un hábito. `kind` good/bad, `metric` check/count/time, y `target` + `period` = la frecuencia ("3 por semana"). `days` es aparte. |
| **habit_log** | Una fila por hábito **por día**, con `amount` (cuánto) y `target` (la meta que regía ese día). Registrar es un **upsert**, no un insert. |
| **`target` congelado** | La meta guardada en la fila del log. Es lo que hace que cambiar la meta no reescriba las rachas viejas (ADR 0009). |
| **`days` (hábito)** | Los días en que se *planea* hacerlo (`{1,3,5}`). **Recordatorio, no regla**: no entra en ningún cálculo. Un hábito de días fijos se modela como cupo (`count 3/week`). |
| **Cumplimiento** | Un hábito `good` cumple al llegar al target (piso); uno `bad`, mientras no lo pase (techo). |
| **Racha de hábito** | Períodos consecutivos cumplidos. No confundir con la racha de `read_log`, que son días con repaso. |
| **Outline** | El rail de headings al margen derecho de una nota: ticks siempre visibles + panel de títulos al hover, marca la sección actual y salta al click. No decir "TOC", "índice" ni "minimapa". Vive en el `Editor`, así aparece en las 3 superficies que renderizan una nota (Nota standalone, Nota en curso, dialog de Repaso). Ver `docs/adr/0007-outline-desde-el-dom.md`. |

## Schema (frozen)

```sql
courses(id, user_id, name, status, started_at, finished_at, icon, source, area, deleted_at, created_at)
  -- status: 'active' | 'paused' | 'done'
  -- icon: 'lucide:<Nombre>' (preset) o URL pública del bucket 'course-icons'. Nullable.
  -- source: dónde se estudió (ej. 'Platzi', 'web.dev'). Texto libre, sin enum. Nullable.
  -- area: tema/categoría del curso. Texto libre single-value (no tags), sin enum. Nullable.
  --   source/area no tienen tabla propia: el <datalist> del form sugiere valores ya usados,
  --   calculados en cliente desde useCourses() — no hay CRUD de categorías.
notes(id, user_id, course_id, title, content, position, deleted_at, created_at)
  -- content: documento Tiptap. course_id uuid references courses(id) on delete set null
read_log(id, user_id, note_id, read_at)

habits(id, user_id, name, icon, kind, metric, target, period, days, deleted_at, created_at)
  -- kind: 'good' (piso) | 'bad' (techo) · metric: 'check' | 'count' | 'time' ('time' = minutos)
  -- target + period ('day'|'week'|'month') = la frecuencia. icon: igual que courses.icon.
  -- days: smallint[] 0=dom … 6=sáb. RECORDATORIO, no regla: no entra en ningún cálculo.
habit_log(id, user_id, habit_id, day, amount, target)
  -- day date (fecha LOCAL, no UTC) · unique (habit_id, day) → registrar es un upsert
  -- target: la meta vigente ese día. Congela el pct. Sin deleted_at: desmarcar es amount = 0.
  -- habit_id uuid references habits(id) on delete set null
```

- RLS en las 5 tablas: `auth.uid() = user_id`.
- Todo derivado, nada denormalizado. Ver `docs/adr/0003-derive-everything-from-read-log.md`.
- **`read_log` y `habit_log` NO son la misma forma, a propósito.** `read_log` sigue append-only,
  sin `target` y sin `deleted_at`: un repaso es un hecho absoluto. Un hábito es un hecho medido
  contra una meta editable, y por eso lleva una fila por día con la meta congelada. El porqué y las
  alternativas descartadas están en `docs/adr/0009-habit-log-por-dia-y-target-congelado.md` — no
  "unificarlas".

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

**Regla general (grilling 2026-07-28, `.scratch/platform-features/`):** la misma lógica aplica a
toda feature nueva fuera de las 3 pantallas, no solo a `goals`. Repo tiene 5 días (primer commit
2026-07-23), loop diario recién armado, sin uso real confirmado todavía. Hasta que el loop diario
esté en uso real: gated — Settings, abstracción DB→localStorage, sidebar de integración AI, tonos
de nota vía AI, themes. Se reabren con el loop diario probado en uso real, no antes.

**Hábitos salió de esa lista (2026-08-20).** Estaba gateado por ser "el mismo territorio que
`goals`", y no lo es: `goals` eran metas de estudio derivables de `read_log` y miradas 1×/semana;
hábitos es una entidad con log propio, tocada a diario, que incluye hábitos **malos** — algo que
ningún derivado de `read_log` puede expresar. El otro gate (loop diario sin uso real confirmado)
sigue sin resolverse: se saltó por **decisión consciente del usuario**, mismo precedente que dejó
escrito el spec de flashcards. Ver `.scratch/habits/spec.md`. `goals` sigue descartado.

**Themes — no MVP, feature a futuro, dirección ya resuelta si se retoma:** multi-theme estilo
preset de editor de código (tipo OneDark/Dracula — un set fijo de colores por preset, no
color-picker custom). Vive en un **Settings dialog** (`Dialog` de Radix vía shadcn, ADR 0005), no
ruta nueva — no reabre "solo 3 pantallas" de `ui-principles.md` porque es overlay, no pantalla
persistente. Hoy sigue el toggle claro/oscuro de `app.tsx:64-69`.

## Seguridad

- La `anon key` va en `.env` (es pública por diseño, protegida por RLS).
- La `service_role key` **nunca** en el cliente ni en el repo.
- `.gitignore` con `.env` desde el primer commit.

## Decisiones

Las grandes están en `docs/adr/`. El resto (Editor.js, CodeMirror, Electron, Obsidian plugin,
VPS, SQLite/Dexie local) fueron descartadas y no se reabren sin razón nueva — el porqué vive en
los specs de cada feature bajo `.scratch/`.
