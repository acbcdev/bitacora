# Sesión de repaso: `advance(grade?)`

**Status:** to-do
**Origen:** review `architecture-review-20260929` candidato 1 · grill 2026-10-01
**Decisión cerrada:** ADR 0020 (enmienda ADR 0012)

## Problema

El handler de Enter está tejido dos veces — `src/review/review.tsx` y `src/review/note-dialog.tsx`:
flush del draft → mark leído → next → toast, con copias de estado alrededor (duplicación viva
tras `75b3336`/`b23dbbd`).

## Decidido en el grill

- `dialogOpen` **se queda en `review.tsx`** — ADR 0012 se respeta tal cual (es UI del dialog).
- Entra **solo `advance(grade?)`** a la interfaz de `ReviewSession`: mark idempotente + next +
  reset de `revealed`. Sin toasts, sin drafts adentro.
- **Sin `open()`** — con `dialogOpen` en review.tsx sería un passthrough de `setDialogOpen(true)`.

## Tareas

- [ ] Agregar `advance(grade?)` a `createReviewSession` + `useReviewSession` (`src/review/review-session.ts`)
- [ ] Reescribir el Enter de `review.tsx`: `flush(); session.advance(grade); toast(...)`
- [ ] Reescribir el Enter de `note-dialog.tsx` igual (combinar con `.scratch/note-draft-unify/`)
- [ ] Tests unitarios en `review-session.test.ts`: idempotencia doble-Enter, reset `revealed`, clamp al final

## Verificación

`pnpm test src/review` + `pnpm test` baseline verde.

## Comments
