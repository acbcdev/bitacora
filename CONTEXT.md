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
→ **PWA** en Cloudflare Pages. Hosting y DB $0, **una** función serverless: la Edge Function
`generate-flashcards` (`supabase/functions/`), que llama a la API de Anthropic con la key
server-side. Eso es lo único que cuesta plata (por token) y lo único que corre fuera del browser:
"sin servidores propios" sigue valiendo para todo lo demás. Ver
`docs/adr/0010-flashcards-como-notas-y-edge-function.md`.

Nivel medio (ver `docs/adr/0005-frontend-stack.md`):

- **Routing:** React Router · **Data/estado servidor:** TanStack Query · **Styling:** Tailwind +
  Radix vía **shadcn/ui** · **PWA:** `vite-plugin-pwa` · **Testing:** Vitest · **pm:** pnpm.
- **Acceso a datos:** el seam **`Store`** (`src/core/store/`) — seis métodos: `snapshot`, `note`,
  `save`, `softDelete`, `uploadCourseIcon`, `generateFlashcards`. Dos adapters detrás:
  `supabaseStore` (default, `supabase-js` + tipos generados) y `localStore` (todo en el
  navegador). Ninguna pantalla importa `supabase-js`. **Sin ORM** (ADR 0006) — `Store` no genera
  SQL ni mapea entidades. Ver ADR 0011.
- **Derivación:** toda en `src/core/store/derive.ts`, funciones puras sobre el `Snapshot`,
  compartidas por los dos adapters. Las pantallas no piden tablas: piden hechos derivados.
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
| **Cola de repaso** | **Lo construido hoy:** `derive.reviewQueue(snapshot, 3)` — un batch de **3** notas/flashcards vivas de cursos vivos, las más viejas primero, `nulls first` (nunca-leídas primero). El `status` del curso **no** filtra: `active`, `paused` y `done` entran igual. Una nota sin curso (`course_id` null) **no** entra. Devuelve **refs sin `content`**: el cuerpo de la que estás mirando lo pide Repaso con `store.note(id)`. El batch se **congela** en el cliente al montar —marcar leído invalida el snapshot, y sin congelarlo se reordenaría abajo del usuario—; "Cargar más" es lo único que lo descongela. `J`/`K` se mueven adentro del batch sin pegarle al store. La RPC `review_queue()` sigue en la DB **sin llamador** (ADR 0011). |
| **Cola one-by-one (NO construido)** | Diseño deseado, todavía sin implementar: `review_queue(exclude_course_id, exclude_note_ids)` sirviendo **una** nota a la vez, con **intercalado forzado** (dos repasos seguidos nunca del mismo `course_id` si hay alternativa), `seen[]` en el cliente como back-stack de `J` y `exclude_note_ids`, y fallback soltando el curso excluido. Estaba escrito acá como si existiera — no existe: la RPC no toma argumentos y `review.tsx` no tiene `seen[]`. Si se construye, hay que hacerlo **en los dos adapters**. Ver `.scratch/retention-system/spec.md`. |
| **Presupuesto de llamadas** | Toda la app se sirve de **una** lectura: `store.snapshot()`. Repaso suma **una por nota servida** (`store.note(id)`, sólo la que estás mirando). `J`/`K` no llaman: se mueven por el batch ya congelado. Marcar leído escribe en `read_log` e invalida el snapshot — la cola no se reordena porque está congelada, no porque no se refetchee. |
| **Flashcard** | Una nota con `kind = 'flashcard'`: el `title` es la pregunta y el `content` la respuesta. **No es tabla propia** (ADR 0010). Se generan con AI desde las notas del curso; se repasan en Repaso (revelar → autoevaluar) y no aparecen en la lista de notas del curso. |
| **Autoevaluación (`grade`)** | Cómo salió una flashcard: `correcto` / `parcial` / `incorrecto`. Va en la fila de `read_log` de ese repaso. En notas normales queda `null`. |
| **% de retención** | `correctos / autoevaluaciones` del curso, derivado de `read_log.grade` — no se guarda (ADR 0003). Se muestra en la pantalla del curso. |
| **Soft delete** | Borrado lógico vía `deleted_at`. La app **nunca** hace `DELETE`. Toda query filtra `deleted_at is null`. |
| **flag `imported`** | Marca notas/cursos migrados de Notion cuyas fechas son estimadas (`created_time` como aprox. de `started_at`). |
| **Habit** | Un hábito. `kind` good/bad, `metric` check/count/time, y `target` + `period` = la frecuencia ("3 por semana"). `days` es aparte. |
| **habit_log** | Una fila por hábito **por día**, con `amount` (cuánto) y `target` (la meta que regía ese día). Registrar es un **upsert**, no un insert. |
| **`target` congelado** | La meta guardada en la fila del log. Es lo que hace que cambiar la meta no reescriba las rachas viejas (ADR 0009). |
| **`days` (hábito)** | Los días en que se *planea* hacerlo (`{1,3,5}`). **Recordatorio, no regla**: no entra en ningún cálculo. Un hábito de días fijos se modela como cupo (`count 3/week`). |
| **Cumplimiento** | Un hábito `good` cumple al llegar al target (piso); uno `bad`, mientras no lo pase (techo). |
| **Racha de hábito** | Períodos consecutivos cumplidos. No confundir con la racha de `read_log`, que son días con repaso. |
| **Store** | El seam de datos (`src/core/store/`). Seis métodos, no uno por query: el adapter trae filas y las escribe, nada más. Decir **Store** y **adapter**, no "repositorio", "servicio" ni "cliente". |
| **Snapshot** | Lo que devuelve `store.snapshot()`: todas las filas VIVAS de las 5 tablas, con las notas **sin `content`**. Es la única query de lectura de la app — todo lo demás es un `select` sobre esto. |
| **Derivación** | Las funciones puras de `derive.ts` que convierten un `Snapshot` en hechos del dominio (cola de repaso, página de cursos, retención, racha). Las comparten los dos adapters: una regla, un lugar. |
| **Modo local** | El adapter que corre entero en el navegador (`localStorage`), sin cuenta y sin red. **Excluyente**, no offline-first: o Supabase o local, nunca los dos, sin sync (ADR 0011). |
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
notes(id, user_id, course_id, title, content, kind, position, imported, deleted_at, created_at)
  -- content: documento Tiptap. course_id uuid references courses(id) on delete set null
  -- kind: 'note' | 'flashcard'. En una flashcard, title = pregunta y content = respuesta (ADR 0010).
read_log(id, user_id, note_id, read_at, grade)
  -- grade: 'correcto' | 'parcial' | 'incorrecto'. Solo se completa si la nota es kind 'flashcard'.

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

1. **Repaso** — la que abre 2–3×/día. La cola trae **una** nota/flashcard a la vez, intercalada por `course_id` (ver Glosario). Corta al llegar a la meta del día: sale el `Empty` con "Cargar más", que libera la cola por el resto de la sesión (el contador sigue honesto — `4/3`, `5/3`).
   - **Nota:** `Enter` abre el dialog; marcar leído (insert en `read_log`) vive ahí, gateado a haber
     scrolleado hasta el final — desde la card se ven 3 líneas, marcar sin leer es basura en el log.
     `⌘/Ctrl+Enter` va directo a la vista expandida.
   - **Flashcard:** `Enter` revela la respuesta; después, autoevaluación explícita con los tres
     botones (correcto / parcial / incorrecto) — insert en `read_log` con `grade`.
   - `J`/`K` = atrás / siguiente sin contar, para las dos, moviéndose por el batch de 3 ya
     cargado (sin pegarle al store). Ver `.scratch/retention-system/spec.md`.
2. **Cursos** — lista con estado, progreso derivado, fechas. La pantalla del curso tiene el % de
   retención y el botón "Generar flashcards" — este último **solo con Supabase**
   (`store.canGenerateFlashcards`), porque necesita la Edge Function.
3. **Nota** — editor Tiptap.

**Auth:** magic link (default de Supabase, cero código). En **modo local** no hay auth: el Login
no se ve y `store.auth.getUser()` resuelve con el usuario del navegador. La app nunca ve el
`Session` de `supabase-js` — el seam devuelve `AuthUser` (`{ email }`), ADR 0011.

**Ajustes:** un `Drialog` (no una ruta — no reabre "solo 3 pantallas"), con tema y modo de
almacenamiento. Se abre con `⌘,`, desde ⌘K o desde el menú de cuenta del sidebar.

## Fuera del MVP (decisión explícita, no olvido)

`goals`/metas · stats y gráficos · búsqueda · tags · offline-first · sync engine.

`goals` se diseñó y descartó a propósito: se mira 1×/semana, es una tabla + CRUD de 2h **después**
de que el loop diario ande. Si vuelve el impulso hacia sync/stats/goals antes de que el loop
diario funcione, es **scope creep** — frenarlo con estos datos, no con opinión.

**Regla general (grilling 2026-07-28, `.scratch/platform-features/`):** la misma lógica aplica a
toda feature nueva fuera de las 3 pantallas, no solo a `goals`. Repo tiene 5 días (primer commit
2026-07-23), loop diario recién armado, sin uso real confirmado todavía. Hasta que el loop diario
esté en uso real: gated — sidebar de integración AI, tonos de nota vía AI, themes (multi-preset).
Se reabren con el loop diario probado en uso real, no antes.

**Settings y la abstracción DB→localStorage salieron de esa lista (2026-08-25).** El gate era
doble: (a) "no hay beneficiario real" y (b) "el loop diario todavía no está en uso real
confirmado". **(a) se resolvió; (b) se saltó por decisión consciente del usuario** — mismo
precedente que hábitos y que el spec de flashcards. La pregunta abierta #5 de
`.scratch/platform-features/` **sigue sin responderse**, y sigue condicionando lo que queda
gateado. Se dice acá para que no parezca resuelta.

Lo que resolvió (a): dejaron de ser generalización especulativa y pasaron a tener beneficiarios
concretos. El seam `Store` borró seis fakes de `supabase-js` de la suite de tests,
hizo testeable sin Postgres lógica que antes no lo era (+25 tests), y arregló que `git clone &&
pnpm dev` sin env no arrancara. Settings dejó de ser "una pantalla por si acaso" cuando apareció
el primer ajuste que necesitaba un hogar — el modo de almacenamiento — y no es pantalla: es un
dialog. El detalle y por qué esto **no** contradice ADR 0001/0004/0006 está en
`docs/adr/0011-store-adapter-supabase-o-localstorage.md`.

**Hábitos salió de esa lista (2026-08-20).** Estaba gateado por ser "el mismo territorio que
`goals`", y no lo es: `goals` eran metas de estudio derivables de `read_log` y miradas 1×/semana;
hábitos es una entidad con log propio, tocada a diario, que incluye hábitos **malos** — algo que
ningún derivado de `read_log` puede expresar. El otro gate (loop diario sin uso real confirmado)
sigue sin resolverse: se saltó por **decisión consciente del usuario**, mismo precedente que dejó
escrito el spec de flashcards. Ver `.scratch/habits/spec.md`. `goals` sigue descartado.

**La AI ya entró, pero solo por una puerta (2026-07-30).** Flashcards generadas con Claude desde la
Edge Function `generate-flashcards` — eso tumbó el blocker de arquitectura que gateaba *todo* el
batch AI: hay dónde poner la key y dónde correr las llamadas (Supabase Edge Functions), y el gasto
por token se aceptó a sabiendas. Lo que **sigue gateado no es la infra, es el chrome**: el "sidebar
de integración AI" choca con `ui-principles.md` #3 (chrome mínimo) y sigue sin caso. Los tonos de nota vía AI ya no necesitan
decisión de arquitectura — viven en Nota, una de las 3 pantallas, y reusan la Edge Function: quedan
como feature a specificar, no como gate. Ver `docs/adr/0010-flashcards-como-notas-y-edge-function.md`.

**Themes — no MVP, feature a futuro, dirección ya resuelta si se retoma:** multi-theme estilo
preset de editor de código (tipo OneDark/Dracula — un set fijo de colores por preset, no
color-picker custom). Vive en un **Settings dialog** (`Dialog` de Radix vía shadcn, ADR 0005), no
ruta nueva — no reabre "solo 3 pantallas" de `ui-principles.md` porque es overlay, no pantalla
persistente. **El Settings dialog ya existe** (`src/settings/settings.tsx`, 2026-08-25): cuando se
retomen los themes, el hogar está y es ahí. Hoy sigue el toggle claro/oscuro, que vive en Ajustes
y en el menú de cuenta del sidebar.

## Seguridad

- La `anon key` va en `.env` (es pública por diseño, protegida por RLS).
- La `service_role key` **nunca** en el cliente ni en el repo.
- `.gitignore` con `.env` desde el primer commit.

## Decisiones

Las grandes están en `docs/adr/`. El resto (Editor.js, CodeMirror, Electron, Obsidian plugin,
VPS, SQLite/Dexie local) fueron descartadas y no se reabren sin razón nueva — el porqué vive en
los specs de cada feature bajo `.scratch/`.
