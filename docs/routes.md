# Routes — pulpo

Fuente de verdad del routing. Si agregás una ruta, actualizá acá y en `src/app.tsx:220-231`.

## Stack
`react-router-dom` + `BrowserRouter` (`src/main.tsx:21`). Definición en `src/app.tsx:2` (`Routes`/`Route`).

## Actuales — 5 patterns, 3 pantallas (`CONTEXT.md:107-119`, `docs/ui-principles.md:53`)

| Path | Component | Archivo | Notas |
|---|---|---|---|
| `/` | `<Review />` | `src/review/review.tsx` | Repaso: cola `derive.reviewQueue(snapshot, 3)` (notas + flashcards mezcladas), congelada al montar. `Enter` abre dialog, `J`/`K` navega sin contar |
| `/courses` | `<Courses />` | `src/courses/courses.tsx` | Lista cursos con estado/progreso derivado. `?new=1` abre form creación |
| `/course/:id` | `<Course />` | `src/courses/course.tsx` | Curso + sus notas (`kind='note'`). Botón "Generar flashcards" + % retención |
| `/course/:id/:noteId` | `<Course />` | `src/courses/course.tsx` | Misma pantalla, nota enfocada. Con `?focus=1` entra en focus mode |
| `/note/:id` | `<Note />` | `src/notes/note.tsx` | Solo orphans (`course_id null`). Con curso, usa la ruta de arriba |

Auth gate: `src/app.tsx:48-50` — sin `session` renderiza `<Login />` (`src/login/login.tsx`), no hay ruta `/login`.
Shell: `src/app.tsx:55` — sidebar + overlays (`⌘K` palette `src/core/components/command-palette.tsx`, `?` cheatsheet `src/core/components/cheatsheet.tsx`, `F` focus mode).

## No son rutas (a propósito — overlays)

`docs/ui-principles.md:53` prohíbe 4ta pantalla sin reabrir scope. Esto va como overlay:

| Feature | Dónde vive | Por qué no es ruta |
|---|---|---|
| Hábitos — tira + panel | `src/review/review.tsx` + `src/habits/habit-tiles.tsx` / `habit-panel.tsx` | Tiles en Hoy debajo del repaso, `Dropover` (`src/core/ui/dropover.tsx`) para 14 días, `Dialog` (`src/habits/habits-dialog.tsx`) para CRUD |
| Settings / Themes | `Dialog` (Radix vía shadcn, `CONTEXT.md:151-155`) | Toggle `bita-theme` ya en `src/app.tsx:64-69` + `src/core/components/sidebar.tsx`. Multi-theme futuro mismo Dialog, no ruta |
| Flashcards gen | Botón en `src/courses/course.tsx:208` → `supabase/functions/generate-flashcards` (ADR 0010) | No es pantalla, es acción |

## Pendientes para seguir — NO son rutas nuevas

Ordenado por costo/conflicto (`/.scratch/platform-features/to-grill-platform-features.md:100-154`, `/.scratch/retention-system/to-grill-retention-system.md:59-118`):

### Tier 1 — listo para spec-ear (sin blocker)
1. **Intercalado forzado** — **no existe**: decía que `review_queue()` lo garantizaba y esa RPC
   nunca intercaló (ordena sólo por último repaso). Hoy la cola es `derive.reviewQueue`, así que
   si se construye va en JS y sale gratis para los dos adapters. Sin spec todavía.
2. ~~**Mobile Repaso**~~ — **hecho** (2026-08-24, `.scratch/drialog/spec.md`). La brecha era solo
   la superficie de overlay: viewport meta, Sidebar→Sheet, `useIsMobile`, `Dropover` y
   Cursos-fuerza-cards ya existían. `Drialog` (`src/core/ui/drialog.tsx`) cierra el hueco.
3. **Más shortcuts** — inventario de acciones sin tecla (`docs/ui-principles.md:24-46`).
4. **Tonos de nota vía AI** — vive en `Note` (`src/notes/note.tsx` + `src/core/components/editor.tsx`), reusa Edge Function `generate-flashcards` (ADR 0010). Solo falta spec.

### Gateados — no tocar sin grill
- **Sidebar AI** — bloqueado por `ui-principles.md#3` "chrome mínimo". Infra resuelta (ADR 0010), falta caso de uso.
- **DB abstraction → localStorage** — RECHAZADO, contradice ADR 0001+0004+0006. YAGNI.
- **`projects[]` / simulación** — 4ta entidad, necesita ADR + spec propia.

## Regla para agregar una ruta
1. Grill contra `docs/ui-principles.md:53` y `CONTEXT.md:107` — ¿por qué no puede ser `Dialog`/`Dropover`?
2. Si pasa, actualizar esta tabla + `src/app.tsx` + `CONTEXT.md` "Las 3 pantallas".
3. Agregar `Route` en `src/app.tsx:220` y acción en `src/core/components/command-palette.tsx:121` + `sidebar.tsx`.
