# ADR 0020 — `advance(grade?)` en la Sesión de repaso: marcar-leído-y-siguiente es una sola operación

**Status:** Accepted
**Fecha:** 2026-10-01
**Enmienda:** ADR 0012 — le agrega un método a la interfaz de `ReviewSession`; todo lo demás de 0012 sigue en pie (`dialogOpen`/`confirmingDelete` **siguen** siendo UI del render).

## Contexto

El handler de Enter está tejido dos veces: en `src/review/review.tsx` y en `src/review/note-dialog.tsx` — flush del draft → mark leído → next → toast, cada uno con sus copias de estado alrededor (duplicación que volvió con el "un solo modo editable" de `75b3336`; ver review `architecture-review-20260929`, candidato 1). La interfaz de la Sesión quedó tan corta que los orbes compensan duplicando lógica alrededor.

El mismo review proponía además meter `dialogOpen` y `open()` en la Sesión. Grillado 2026-10-01: **no**. ADR 0012 dice explícito que `dialogOpen` es UI del dialog, no de la sesión — y con la decisión de que `dialogOpen` siga en `review.tsx`, un `open()` sería un passthrough de `setDialogOpen(true)`: renombrar no es depth.

## Decisión

La interfaz de la Sesión de repaso crece **un solo método**:

```ts
advance(grade?: Grade): void
// = mark(grade?) idempotente + next() + reset de revealed.
// No dispara toasts ni toca drafts: eso queda en el caller.
```

Con eso el Enter se reduce a la misma línea en ambas superficies:

```ts
flush()
session.advance(grade)
toast("Leída")
```

- `dialogOpen` **se queda en `review.tsx`** (grill 2026-10-01) — un `useState` no paga romper la pureza de `createReviewSession`.
- Sin `open()` — passthrough, shallow.
- El toast es presentación: fuera de la sesión (sigue sin React, sigue testeable con spy).

## Consecuencias

- La duplicación del Enter muere: la regla "leído y avanzar" vive en un lugar; un bug de idempotencia se arregla una vez y cubre pantalla + diálogo.
- Los tests unitarios de la sesión (`review-session.test.ts`) cubren `advance` (idempotencia con doble Enter, reset de `revealed`) sin DOM.
- review.tsx baja las líneas de handler; el diff es chico y verificable (nada de big bang — 0012 ya descartó esa alternativa).

## Alternativas descartadas

1. **`open()` también en la Sesión** — passthrough de `setDialogOpen(true)`; profundidad cero.
2. **`dialogOpen` adentro de la Sesión** — contradice ADR 0012, rompe la pureza de `createReviewSession` (testable sin DOM).
3. **No agregar nada, componer `mark() + next()` a mano** — la duplicación viva del Enter queda en dos superficies.

## Qué deja gateado

Lo mismo que 0012 (Cola one-by-one, `seen[]`, `QueueStrategy`). Si el diálogo de nota necesita confirmación de borrado, `confirmingDelete` también queda en la UI — no entra a la Sesión.

## Verificación

- `pnpm test src/review/review-session.test.ts` — `advance` idempotente, reset de `revealed`, clamp en fin de cola.
- `pnpm test src/review/review.test.tsx` — Enter delega a `advance` en pantalla y en diálogo.
- `pnpm test` — baseline verde.
