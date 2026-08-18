# ADR 0008 — Sembrar el cache cuando la mutation ya devuelve la fila

**Status:** Accepted

## Contexto

Crear nota con `n` en la pantalla Curso se sentía lento. Anatomía del flujo original — **cuatro
roundtrips secuenciales** antes de ver el editor:

1. `SELECT position ... ORDER BY position DESC LIMIT 1` para calcular `position = max+1`.
2. `INSERT ... .select("id")` — pedía de vuelta solo el id.
3. `invalidateQueries(["notes", courseId])` → refetch de la lista.
4. `navigate` → monta `NoteEditor` → `useNote(newId)` → `SELECT` de la nota recién creada
   (mientras tanto: `NoteSkeleton`).

Dos cosas se **midieron**, no se supusieron (test `course-create-note.test.tsx`, latencia de 400ms
por SELECT):

- **El paso 3 era bloqueante.** `onSuccess` devolvía la promesa de `invalidateQueries`, y TanStack
  espera esa promesa antes de correr el `onSuccess` del `mutate()` — donde vive el `navigate`.
  Medido: **372ms de un refetch de 400ms**.
- **Sacarle el `return` sin más rompe la navegación.** El efecto de auto-corrección de URL de
  `Course` (`course.tsx:83-87`) busca `noteId` en la lista; con la lista vieja no lo encuentra y
  hace `replace` a la primera nota del curso. Verificado: la URL terminaba en la nota vieja.

## Decisión

Cuando la mutation ya tiene la fila del server, **sembrar el cache** (`setQueryData`) en vez de
pedirla otra vez. En `useCreateNote`:

- `position` sale del cache de `useNotes` (ya cargado en la pantalla), no de un SELECT.
- El INSERT pide `.select("*")` — la fila entera, mismo request, mismo costo.
- `onSuccess` siembra `["note", id]` y appendea a `["notes", courseId]`.
- El `invalidateQueries` **queda**, pero sin devolver la promesa: refetch de fondo que reconcilia
  cambios hechos desde otro device, sin bloquear la navegación.

Queda **un solo roundtrip** en todo el flujo: el INSERT.

## Regla

- ¿El server sabe algo que el cliente no puede calcular? → `invalidateQueries`. Es el caso de todo
  lo derivado de `read_log` (ADR 0003): racha, "leídas hoy", progreso.
- ¿La respuesta ya está en la mano? → `setQueryData`.

No reemplaza al patrón por defecto de ADR 0005 (invalidar): lo acota al caso donde invalidar es
preguntar dos veces lo mismo.

## Lo que NO se hizo

**Optimismo real** (uuid en cliente + navegar antes del INSERT, con `onMutate` + rollback). Ahorra
el último roundtrip (~150ms) y a cambio abre una carrera con el autosave: `useNoteDraft` dispara
`update` a los 800ms (`notes.api.ts`), y un `update ... eq(id)` de PostgREST sobre **0 filas
devuelve 204 sin error** — el tipeo se pierde en silencio, sin toast. Pagar riesgo de pérdida de
datos por 150ms es mal trade. Se reabre solo con el número medido de ese último roundtrip sobre la
mesa, y resolviendo antes la carrera (upsert o gate del autosave).

**`useOptimistic` de React 19** no aplica acá aunque la versión lo soporte: es estado local del
componente y el flujo **navega** (el componente se desmonta), el estado de servidor lo maneja Query
(ADR 0005) y el valor optimista se descarta al terminar la transition — igual habría que sembrar el
cache. Sirve para UI local que no sale del componente, no para esto.

## Consecuencias

- `useCreateNote` devuelve la fila (`Note`), no el id. El caller navega con `note.id`.
- Cache viejo → `position` repetido. No hay unique constraint (`0001_initial_schema.sql:24`): dos
  notas con el mismo `position` quedan en orden ambiguo entre sí, no es un error. Un solo usuario
  en un device: no pasa.
- El test guarda las dos cosas medidas: falla si vuelve un SELECT extra al flujo o si alguien
  devuelve la promesa del `invalidateQueries`.
- **Sin tocar:** `["note_refs"]` (índice de la command palette, `app.tsx:59`) no lo refresca nadie
  en todo el repo — la nota nueva no aparece en la palette hasta recargar. Gap preexistente que
  también afecta a borrar y renombrar; se decidió dejarlo fuera de este cambio.
