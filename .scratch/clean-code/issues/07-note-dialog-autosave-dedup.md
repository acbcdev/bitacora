# Duplicación de autosave: note-dialog re-implementa useNoteDraft

**Status:** needs-triage

## Problema

`src/review/note-dialog.tsx:41-70` re-arma el guardado debounced a mano: `pending` ref + `timer`
ref + `flush()` (clearTimeout + mutate) — la misma operación que `useNoteDraft`
(`src/notes/notes.api.ts`) ya resuelve con `schedule()`/`save()`/`getDoc()`, la MISMA constante de
800ms y el MISMO `useUpdateNote` debajo. Dos implementaciones del autosave de una nota = dos
lugares donde tocar si cambia el debounce, el flush o el "Guardado HH:MM".

## Qué decide el triage

Reusar `useNoteDraft(id)` en NoteDialog es el camino corto PERO cambia el flujo: el draft hoy
keyea el reset a `note?.id`, el dialog remonta el editor con `key={note.id}` y su flush se
dispara al desmontar/cambiar de nota. Hay que verificar que el gate de Enter ("leído y
siguiente") y `NoteActions` (que lee `pending.current?.content`) sigan viendo el doc fresco.
Si el acople se complica, la alternativa mínima es extraer el patrón debounce a un helper
compartido y que ambos lo usen — sin unificar los estados.

## Criterio

- El suite de review (note-dialog incluido) en verde; ningún cambio visible de comportamiento.
