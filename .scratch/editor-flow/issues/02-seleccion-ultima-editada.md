# Selección inicial en Notebook = última editada

**Status:** ready-for-agent

Blocked by: 01 (la columna `updated_at` tiene que existir).

## Qué

Al entrar a `/notebook/:id` sin noteId (o con noteId inexistente), hoy caés en la **primera** nota
de la lista (`notebook.tsx:96` — `notes.find(...) ?? notes[0]`, orden por `position`).

Cambio: la selección inicial es la nota con `updated_at` **máximo**. El índice NO se reordena —
la lista queda por `position` (si se reordenara por edición, los títulos saltarían mientras
escribís; decisión explícita del grill).

## Detalle

- `NoteRef` (`src/core/store/types.ts:32`) suma `updated_at`: el snapshot pasa a traer un
  timestamp más por nota (~1.500 filas, barato).
- El efecto de auto-corrección de URL (`notebook.tsx:104-108`) es el que elige la nota por
  defecto: ahí va el max. Con noteId válido, nada cambia.
- Con el filtro de búsqueda activo no aplica: la selección inicial solo importa al entrar.
