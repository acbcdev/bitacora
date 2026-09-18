# ADR 0015 — Draft de nota: el borrador local es la autoridad; el server escribe sólo al cambiar de nota

**Status:** Accepted

## Contexto

`useNoteDraft` (`src/notes/notes.api.ts`) sostiene el autosave debounced de título + doc Tiptap.
El doc vive en un **ref** a propósito (cada keystroke ya re-renderiza por `title`; meter el doc en
estado duplicaría el render) y el título en `useState`. La sincronización server → draft la hacía
un effect keyeado a `[note]` — la **identidad del objeto** que devuelve la query, no su id:

```ts
useEffect(() => {
  if (!note) return
  setTitle(note.title)
  doc.current = note.content
  setSavedAt(null)
}, [note])
```

Eso dispara un ciclo que la regla `no-adjust-state-on-prop-change` del react-doctor marcó y el
grilling (`.scratch/react-doctor-triage/spec.md`, 2026-09-17) confirmó como bug, no como falso
positivo. El loop real:

1. El usuario tipea → `schedule()` → a los 800 ms `save()` hace `update.mutate`.
2. `useUpdateNote.onSuccess` **invalida** `["note", id]` → refetch → llega un objeto `note`
   nuevo → el effect vuelve a correr.
3. Consecuencias: el tipeo hecho en la ventana entre autosave y refetch **se pisa** con lo
   guardado; el indicador "Guardado HH:MM" se borra solo (`setSavedAt(null)` post-refetch); y el
   estado local se pisa con una copia redundante de lo que el usuario mismo acaba de guardar.

El patrón canónico de React (ajustar estado durante el render, con un estado `prev` que trackee
la identidad) cubriría el caso, pero el doc está en un ref deliberadamente, y justificar mutación
de refs en fase de render complicaba el hook para arreglar lo mismo.

## Decisión

**1. El reset del draft keyea al id de la nota, no a la identidad de la query.** El effect pasa a
`[note?.id]`: título, doc y `savedAt` se resetean **sólo al abrir otra nota**. Dentro de la misma
nota, el draft local es la autoridad — lo que hay en pantalla es lo más nuevo que existe, y el
eco del server de un autosave propio es redundante y dañino.

**2. Trade-off aceptado: cambio externo no se propaga.** Si la misma nota se renombra/edita desde
otra superficie (otra pestaña, otro dispositivo) mientras está abierta, el editor no lo refleja y
el próximo autosave pisa el cambio externo. Se acepta por dos razones: la app es single-user y
de una pestaña (CONTEXT.md: datos chicos, sin sync engine — Fuera del MVP), y el comportamiento
previo "resolvía" ese caso pisando el tipeo del usuario en cada refetch — peor.

**3. Lo que NO cambia:** el flujo de guardado completo — refs `latest`/`doc`, `schedule()` con
debounce de 800 ms, el cleanup del timer al desmontar, y `setSavedAt(null)` al cambiar de nota
(quiere decir "todavía no guardaste nada en esta nota"). El fix es una línea de key de effect;
la semántica del hook queda intacta.

## Consecuencias

- El indicador "Guardado HH:MM" sobrevive al refetch del autosave.
- Ningún refetch de `["note", id]` puede pisar tipeo en curso.
- Muere el flag `no-adjust-state-on-prop-change` de `notes.api.ts` sin patrón nuevo: la regla
  pide no sincronizar props/queries → estado por efecto; acá el estado deja de seguir a la query
  (sólo se inicializa al cambiar de nota), que es la forma canónica del arreglo cuando el estado
  local es más nuevo que la query.
- Si algún día la app soporta edición concurrente real (dos pestañas sobre la misma nota), este
  ADR se reabre con un merge por `updated_at` — descartado hoy como anti-YAGNI.
