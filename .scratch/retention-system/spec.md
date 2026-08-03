# Feature: flashcards (retención — fase 1)

**Status:** ready-for-agent
**Blocked by:** ninguno

Resultado del grill en `to-grill-retention-system.md`. Primer recorte del sistema de retención más
amplio (flashcards / intercalado / simulación) — este spec cubre **solo flashcards**. Intercalado
forzado y `proyectos[]` (simulación) quedan fuera, ver Out of Scope.

## Problem Statement

Hoy Repaso es binario: `Space` marca una nota como leída y avanza. No mide si el usuario realmente
recuerda el contenido, no da forma de practicar activamente (pregunta → intento de respuesta →
autoevaluación) en vez de solo releer, y no hay ningún % de retención — solo "leída sí/no".

## Solution

Un modo nuevo dentro de la pantalla Repaso (no una pantalla nueva — siguen siendo 3). Las flashcards
se generan con AI a partir de las notas existentes de un curso y se intercalan en la misma cola de
repaso (`review_queue`) que las notas normales. En vez de "Marcar leído", el usuario ve la pregunta,
revela la respuesta, y se autoevalúa: correcto / parcial / incorrecto. Ese grade queda en `read_log`
y de ahí se deriva el % de retención — sin tablas nuevas, sin scheduling tipo Leitner todavía (queda
anotado como pending feature explícito, no se construye en esta fase).

## User Stories

1. Como usuario, quiero generar flashcards a partir de las notas de un curso con un botón en la
   pantalla Curso, para no tener que escribir preguntas y respuestas a mano.
2. Como usuario, quiero que las flashcards generadas usen el contenido real de mis notas, para que
   las preguntas sean relevantes a lo que estudié.
3. Como usuario, quiero ver las flashcards intercaladas con las notas normales en la cola de Repaso,
   para no tener que cambiar de pantalla ni acordarme de repasarlas aparte.
4. Como usuario, quiero ver primero solo la pregunta de una flashcard, para poder intentar
   responderla antes de ver la respuesta.
5. Como usuario, quiero revelar la respuesta con una tecla o click, para controlar el ritmo de mi
   propio repaso.
6. Como usuario, quiero autoevaluarme como correcto / parcial / incorrecto después de ver la
   respuesta, para que el sistema registre qué tan bien me acuerdo.
7. Como usuario, quiero que mi autoevaluación quede guardada en el historial de repaso, para poder
   ver mi % de retención más adelante.
8. Como usuario, quiero ver mi % de retención derivado de mis autoevaluaciones, para saber qué
   cursos necesito reforzar.
9. Como usuario, quiero que las flashcards que marco como "incorrecto" vuelvan a aparecer en la
   cola, para poder repasarlas de nuevo — por ahora con el mismo orden FIFO que cualquier nota, sin
   prioridad especial.
10. Como usuario, quiero que las flashcards NO aparezcan en la lista de notas de la pantalla Curso,
    para no confundirlas con mis notas de estudio reales.
11. Como usuario, quiero que las flashcards NO cuenten en el % de progreso del curso, para que ese
    número siga midiendo solo mis notas reales.
12. Como usuario, quiero poder seguir usando `Space` para marcar una nota normal como leída dentro
    de la misma cola, para no perder el flujo que ya uso.
13. Como usuario, quiero que `J` / `K` sigan funcionando para saltar sin contar, sin importar si el
    ítem actual es nota o flashcard.
14. Como usuario, quiero que el botón "Generar flashcards" solo esté habilitado en cursos que ya
    tienen notas, para no generar flashcards de la nada.
15. Como usuario, quiero un estado de carga claro mientras se generan las flashcards (la llamada a
    AI puede tardar unos segundos), para saber que la app no se colgó.
16. Como usuario, quiero que un error de generación (falla la llamada a AI) me avise con un mensaje
    claro, para poder reintentar.
17. Como usuario, quiero poder borrar una flashcard igual que borro una nota (soft delete), para
    sacar preguntas mal generadas sin perder el historial de repaso ya hecho sobre ella.
18. Como usuario, quiero que las flashcards respeten RLS igual que `notes` y `read_log`, para que
    sigan siendo privadas por usuario.

## Implementation Decisions

**Schema — sin tablas nuevas, 2 columnas.** El proyecto todavía no tiene una base desplegada con
historial real que preservar, así que estos cambios se editan directo en las migraciones existentes
en vez de agregar una `0005_*.sql` — mismo criterio ya usado en `f46e8ca` (fix a `review_queue`
editado in place en `0003_derived_queries.sql`).

- `supabase/migrations/0001_initial_schema.sql`:
  - `notes.kind text not null default 'note' check (kind in ('note', 'flashcard'))`.
  - `read_log.grade text check (grade in ('correcto', 'parcial', 'incorrecto'))` — nullable, solo se
    completa cuando el ítem repasado es una flashcard.
- `supabase/migrations/0003_derived_queries.sql`:
  - `course_progress()`: agregar `and n.kind = 'note'` al `where`, para que las flashcards no
    infllen el progreso derivado del curso.
  - `review_queue()`: **sin cambios.** Ya hace `select n.*` ordenado por `max(read_at)` — las
    flashcards se intercalan automáticamente con las notas por antigüedad de repaso, gratis.
- Sin índice nuevo para `kind` — dataset chico (~1.500 notas), mismo criterio que CONTEXT.md ya
  aplica al resto del schema.

**Cliente — excluir flashcards de las pantallas de notas.** `src/notes/notes.api.ts`: agregar
`.eq("kind", "note")` a `useNotes`, `useAllNoteRefs` y `useNote` — mismo patrón ya usado ahí con
`.is("deleted_at", null)` (repetido a mano en cada query), no una vista de Postgres nueva. Se
prefiere consistencia con el estilo existente del archivo por sobre introducir un mecanismo nuevo.

**Generación.** Módulo nuevo `src/flashcards/flashcards.api.ts`:
- `useGenerateFlashcards(courseId)`: invoca una Supabase Edge Function nueva (`generate-flashcards`)
  que recibe `course_id`, lee server-side las notas vivas de ese curso, llama a un LLM con la API
  key del lado del servidor (nunca en el cliente — mismo principio que `service_role key` en
  CONTEXT.md), y devuelve una lista de pares pregunta/respuesta.
- El cliente inserta cada par como fila en `notes`: `kind: 'flashcard'`, `course_id`, `title` =
  pregunta, `content` = respuesta envuelta en un doc Tiptap mínimo (mismo shape que usa una nota
  normal).
- Tope de flashcards generadas por llamada: sugerido 10, ajustable — no bloqueante para este spec,
  el implementador puede afinarlo.

**Repaso.** `src/review/review.tsx`: branch de UI por `note.kind`:
- `kind === 'note'`: flujo actual sin cambios (`Space` = leído + siguiente).
- `kind === 'flashcard'`: mostrar `title` (pregunta) → revelar (tecla o click) → mostrar `content`
  (respuesta) → 3 botones (correcto / parcial / incorrecto), cada uno inserta en `read_log` con
  `note_id` + `grade` y avanza igual que `next()` hoy.

`src/review/review.api.ts`: extender el insert de `read_log` para aceptar un `grade` opcional.

**Curso.** `src/courses/course.tsx`: botón nuevo "Generar flashcards" en el aside, junto a "Nueva
nota" — deshabilitado si `notes.length === 0`.

**% de retención.** Derivado, no denormalizado (ADR 0003): `count(*) filter (where grade =
'correcto') / count(*) filter (where grade is not null)` sobre `read_log`, agrupado por curso. Dónde
se muestra queda abierto para el implementador — CONTEXT.md prohíbe explícito una pantalla nueva de
stats/gráficos, así que se sugiere un badge chico dentro de la pantalla Curso, no un gráfico ni
tabla nueva.

## Testing Decisions

Buen test acá = comportamiento observable (qué se renderiza, qué fila se inserta), no detalle de
implementación — mismo criterio que ya sigue `review.test.tsx`.

- **Seam 1 — `src/review/review.test.tsx`** (extender el existente, mismo patrón de mock del cliente
  Supabase como chain thenable). Casos: cola mixta nota + flashcard renderiza cada una distinto;
  click en un botón de grade hace exactamente 1 insert en `read_log` con el `grade` correcto y
  avanza; `J` / `K` siguen saltando sin insertar sin importar el `kind` del ítem actual.
- **Seam 2 — `src/courses/course.test.tsx`** (nuevo — no existe hoy, `course-icon.test.tsx` e
  `icon-picker.test.tsx` sí existen como precedente de cómo testear en esta carpeta). Mock de la
  Edge Function; click en "Generar flashcards" inserta N filas en `notes` con `kind: 'flashcard'`;
  el botón queda deshabilitado si el curso no tiene notas.
- Sin tests unitarios para las funciones SQL (`review_queue`, `course_progress`) — el repo no tiene
  tests de RPC hoy; se verifican indirectamente a través del Seam 1.

## Out of Scope

- **Scheduling tipo Leitner** (que "incorrecto" haga volver la flashcard antes que las demás).
  Explícitamente pending feature — se sube después si el FIFO plano no alcanza.
- **Intercalado forzado** (N `course_id` distintos por batch en `review_queue`) — Tier 1 del grill
  original, spec propio, no éste.
- **`proyectos[]` / simulación** — Tier 3 del grill original, entidad nueva independiente, no
  bloqueada por este spec ni lo bloquea.
- **Pantalla o gráfico de stats dedicado** — CONTEXT.md lo prohíbe explícito fuera del MVP. El % de
  retención de esta fase es un dato derivado puntual, no un dashboard.
- **Gestión de flashcards** (editar una flashcard generada, verla en una lista aparte) — más allá
  del soft delete de la historia 17, no hay UI de gestión en esta fase.
- **Elegir o configurar el proveedor de LLM** — no decidido en este spec; la Edge Function
  `generate-flashcards` es el único punto de integración, el proveedor es detalle de
  implementación.

## Further Notes

- El estado de la DB en este momento no tiene datos reales que preservar (ver Implementation
  Decisions) — si eso cambia antes de implementar esto, revisar si conviene volver a una migración
  nueva en vez de editar `0001` / `0003` in place.
- El loop diario (Repaso/Cursos/Nota) sigue sin uso diario real confirmado — este spec se construye
  igual, por decisión consciente del usuario en el grill, no porque CONTEXT.md:86-88 (scope creep)
  ya no aplique.
