# Un solo Borrador de nota: `useNoteDraft` sirve a pantalla y diálogo

**Status:** to-do
**Origen:** review `architecture-review-20260929` candidato 2 · grill 2026-10-01
**Decisión cerrada:** ADR 0021 (extiende ADR 0015)

## Problema

`src/review/note-dialog.tsx` duplica el autosave que ya vive en `useNoteDraft`
(`src/notes/notes.api.ts`): otro timer 800 ms, otro ref `pending`, otro flush al desmontar —
~40 líneas gemelas. Un fix en una superficie no llega a la otra.

## Decidido en el grill

- Un solo módulo, **sin flags**: `useNoteDraft(id: string | null, open = true)`.
- **El título es siempre editable** en ambas superficies — no existe `editableTitle?: boolean`.
- El diálogo deja de tener timer/refs/pending propios; llama `flush()` del hook al cerrar.
- ADR 0015 (reset por id, draft autoridad) aplica automáticamente al diálogo.

## Tareas

- [ ] Extender `useNoteDraft` con el parámetro `open` (no autosavea/flush al cerrar si `open` baja)
- [ ] Borrar el duplicado de `note-dialog.tsx` (~40 líneas) y consumir el hook
- [ ] Mover tests del autosave del diálogo a `notes.api` tests (1 regla, 1 suite)

## Verificación

`pnpm test src/notes src/review` + `pnpm test` baseline verde.

## Comments
