# Spec — Sesión de repaso como deep module

**Feature:** `review-session` (candidato 03 del architecture review 2026-08-25)
**ADR:** `docs/adr/0012-sesion-de-repaso-como-deep-module.md`
**Glosario:** `CONTEXT.md` — Sesión de repaso / Cola de repaso / Cola one-by-one (NO construido)
**Stack:** Vite + React + TanStack Query + `src/core/store` seam + `src/test/harness.tsx:152` `renderApp`

## Problema

`src/review/review.tsx:81` 497 líneas hace 5 trabajos en un componente: sesión (queue congelada + index + markedIds + revealed + dialogOpen), render Note, render Flashcard, embed HabitTiles, embed Courses. Seis piezas de estado `src/review/review.tsx:86-102` + freeze frágil `src/review/review.tsx:86-89` + guards de `Enter` `src/review/review.tsx:162-167` tejidos con JSX. Test surface es el DOM `src/review/review.test.tsx:335`.

## Solución

Deep module `src/review/review-session.ts` que ownéa la **Sesión de repaso**: pura `createReviewSession` + hook `useReviewSession`. `Review()` queda composición.

Vocabulario cerrado (no sinónimos): decir **Sesión de repaso**, **Cola de repaso**, **Cola one-by-one**, **Store/adapter**, **Snapshot**, **Derivación** — `docs/agents/domain.md:43`.

## Estructura del trabajo

3 issues tracer-bullet `.scratch/review-session/issues/` — cada uno vertical, shippable, con criterio de done propio. Orden estricto 01→02→03.

| # | Issue | Qué entrega | Toca |
|---|-------|-------------|------|
| 01 | `01-pura-review-session.md` | `review-session.ts` pura + `review-session.test.ts` unit | Solo nuevo, no rompe `review.tsx` |
| 02 | `02-wire-freeze-navegacion.md` | Hook + migra estado de `review.tsx`, recorta `review.test.tsx` a 5 integración | `review.tsx`, `review.test.tsx`, harness |
| 03 | `03-partir-cards.md` | Extrae `NoteCard`/`FlashcardCard`, `Review()` ~150 líneas | `review.tsx`, cards nuevos |

Intercalado + `seen[]` + `review_queue(exclude_*)` **gateados** en `.scratch/retention-system/to-grill-retention-system.md` — seam interno ya existe vacío en 01, no se implementa hasta spec propio.

## Presupuesto y límites

- No tocar `src/core/store/derive.ts` (puras `Snapshot → hechos`).
- No importar `store` en la pura — `markRead` inyectado.
- No meter `dialogOpen`/`confirmingDelete` en sesión.
- No tocar `src/courses/` ni `src/habits/` en este slice.

## Verificación global

- `pnpm test src/review/review-session.test.ts` unit verde
- `pnpm test src/review/review.test.tsx` integración verde
- `pnpm test` 166 verdes baseline
- `wc -l src/review/review.tsx` ~150-180 tras 03
