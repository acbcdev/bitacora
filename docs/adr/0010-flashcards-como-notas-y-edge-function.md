# ADR 0010 — Flashcards como `notes` + Edge Function para la AI

**Status:** Accepted (implementado 2026-07-30, commit `bcb4267`)

## Contexto

El grill de retención (`.scratch/retention-system/`) pidió flashcards con autoevaluación y % de
retención, y estimó el costo en **dos tablas nuevas** (`flashcards` + `flashcard_log` con Leitner
boxes) — o sea romper el "schema frozen" de ADR 0003 y sumar una cuarta entidad con su propio log,
su propio algoritmo y su propia cola.

Al mismo tiempo, generar las flashcards con un LLM chocaba con dos cosas escritas: "costo $0, sin
servidores propios" (CONTEXT.md) y ADR 0006, que cierra la puerta al backend salvo un caso —
textual: *"si aparece un backend propio (Edge Functions / server)"*.

## Decisión

**1. Una flashcard ES una nota.** `notes.kind text not null default 'note' check (kind in ('note',
'flashcard'))`. El `title` es la pregunta, el `content` (doc Tiptap) es la respuesta.

**2. La autoevaluación es una columna de `read_log`:** `grade text check (grade in ('correcto',
'parcial', 'incorrecto'))`, nullable — en una nota normal queda `null`. Repasar una flashcard sigue
siendo un `insert` en `read_log`, igual que leer una nota.

**3. La AI vive en una Edge Function** (`supabase/functions/generate-flashcards`): recibe un
`course_id`, lee las notas vivas del curso, le pide hasta 10 pares pregunta/respuesta a Claude con
`json_schema`, y devuelve el JSON. **El cliente inserta las filas**, no la función.

Las dos columnas se agregaron **editando `0001_initial_schema.sql`**, no con una migración nueva —
queda anotado porque es la excepción, no la regla: hábitos (ADR 0009) sí fue migración aparte
(`0010_habits.sql`) para no tocar entidades con datos vivos. Ante la duda, migración nueva.

## Por qué así y no con tablas propias

- **Todo lo que una flashcard necesita ya lo tiene una nota**: dueño, curso, soft delete, editor,
  historial de repasos. Una tabla propia duplicaba las cinco cosas para ganar cero.
- **Sale gratis intercalarlas.** `review_queue()` devuelve `setof notes` ordenado por último repaso:
  las flashcards entran a la cola mezcladas con las notas sin tocar la RPC. Con tabla aparte hacía
  falta una segunda cola y una regla de merge.
- **El % de retención queda derivado** (`correctos / autoevaluaciones` sobre `read_log.grade`), que
  es exactamente ADR 0003 — no una columna guardada, no un `flashcard_log` paralelo.
- **Leitner / SM-2 quedaron afuera.** El orden por `max(read_at)` ya trae primero lo más viejo; los
  intervalos por caja son el paso siguiente, no el primero. Si se agregan, el `grade` ya está en la
  DB para calcularlos — no hay dato que recuperar.

Costo del atajo: las flashcards heredan cosas de nota que no usan (`position`, el editor completo) y
**toda query de notas tiene que filtrar `kind`**. Ya pasa en `useNotes` (`.eq("kind", "note")`, tres queries) y en
`course_progress()` (`where n.kind = 'note'`, si no el progreso del curso lo diluyen las flashcards).
Es el precio, y es explícito: al agregar una query de notas, decidir el `kind`.

## Por qué la key va en una Edge Function y no en el cliente

Misma razón por la que ADR 0001 descartó Turso: un secreto en el browser es un secreto público. Una
`ANTHROPIC_API_KEY` en el bundle es facturación abierta a cualquiera que abra devtools.

La función corre con **el JWT del usuario** (`SUPABASE_ANON_KEY` + header `Authorization`), no con
`service_role`: RLS sigue filtrando las notas por dueño dentro de la función. El único secreto
server-side es la key de Anthropic.

## Consecuencias

- **El "$0" dejó de ser literal.** Hosting y DB siguen gratis; las llamadas al LLM se pagan por
  token. Es una función y un botón ("Generar flashcards", una vez por curso), no un asistente que
  corre solo — el gasto está acotado a un click explícito. Sumar features AI **sí** mueve esa cuenta.
- **ADR 0006 se reabrió por su propio caso, y se re-decidió igual: sigue sin ORM.** Apareció el
  backend, pero la Edge Function habla por `supabase-js` con el JWT del usuario, así que el
  argumento entero de ADR 0006 (RLS es el modelo de seguridad, un ORM lo bypassa) vale igual del
  lado del servidor. Un ORM ahí tendría dónde correr y seguiría sin tener por qué.
- **Hay una superficie server-side que mantener** (deploy, secrets, versión del SDK). Era cero antes.
- **`docs/handoff.md` quedó viejo a propósito**: es el snapshot del día 1 (2026-07-23), no la fuente
  de verdad. El schema vigente está en CONTEXT.md.
