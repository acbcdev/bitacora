# Migration: notes.updated_at con trigger auto-update

**Status:** ready-for-agent

## Qué

`notes` no tiene `updated_at` (verificado en `supabase/migrations/0001_initial_schema.sql`) y es
el dato que necesita la selección "última editada" (issue 02).

Migración `0013`:

1. `alter table notes add column updated_at timestamptz not null default now();`
2. Backfill: `update notes set updated_at = created_at;` — las notas existentes "nacieron" en su
   creación; no hay forma de saber cuándo se editaron por última vez y eso está bien.
3. Trigger: en cualquier UPDATE de `notes`, `updated_at = now()`. El autosave del editor (debounce
   800ms sobre `content`) y la edición de título la mantienen fresca — no hace falta código de app.

## Nota

- El adapter de Supabase ya hace `update` directo; el trigger vive en Postgres, cero cambios de app.
- El modo `localStorage` (ADR 0011) también guarda filas de notes: si su adapter repite la shape,
  el `updated_at` lo setea el adapter al guardar (o un `updated_at ?? created_at` al leer). Que el
  local adapter mantenga la misma shape que la migración.
