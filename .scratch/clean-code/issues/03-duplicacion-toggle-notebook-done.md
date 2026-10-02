# Duplicación: toggle "Marcar finalizado / Reabrir notebook"

**Status:** resolved

## Problema

El payload del toggle y su UI están duplicados en dos pantallas:

- `src/core/components/sidebar.tsx:265-272` (NotebookMenuItem): `updateNotebook.mutate(done ? { id, status: "active", finished_at: null } : { id, status: "done", finished_at: new Date().toISOString() })` + label "Reabrir notebook"/"Marcar finalizado" + íconos `RotateCcw`/`Check`.
- `src/notebooks/notebook.tsx:249-258`: exactamente el mismo ternario, los mismos labels y los mismos íconos.

También el ítem "Fijar/Desfijar" (`togglePinnedNotebook` + `Pin`/`PinOff` + labels) está repetido en los dos.

## Fix

Un helper en `src/notebooks/notebooks.api.ts` (donde ya vive `useUpdateNotebook`), p. ej.
`toggleNotebookDone(notebook): NotebookInput` que devuelva el payload. Los labels/íconos pueden
quedar en cada pantalla (son JSX) o en el helper si es mecánico.

## Criterio

- Cambio mecánico, sin cambio de firma de nada exportado del store.
- Tests existentes (`sidebar.test.ts`) en verde.

## Answer

`toggleNotebookDone(notebook)` en `notebooks.api.ts` (devuelve `NotebookInput & { id: string }`);
`sidebar.tsx` y `notebook.tsx` consumen el helper. Mecánico, tests en verde.
