# 01 — Pura `review-session` (sin tocar `Review`)

**Status:** listo para tomar
**Spec:** `.scratch/review-session/spec.md`
**ADR:** `docs/adr/0012-sesion-de-repaso-como-deep-module.md`
**Blocked by:** ninguno
**Toca:** solo archivos nuevos (`src/review/review-session.ts`, `src/review/review-session.test.ts`) — `src/review/review.tsx:81` no se modifica salvo un import opcional en feature flag

## Objetivo

Crear el deep module como pura testeable, sin React ni Store. Esconde lo que hoy está desparramado en `src/review/review.tsx:86-102` y expone la interfaz chica que el reporte promete.

## Forma

```ts
// src/review/review-session.ts
import type { NoteRef } from "@/core/store/types"
import type { ReadStats } from "@/core/store/derive"
import type { Grade } from "@/core/types/database"

export type ReviewSession = {
  item: NoteRef | null
  position: string // "2 / 3" | "" si done
  index: number; length: number; done: boolean
  revealed: boolean
  marked: boolean
  reads: number // de stats.byNote.get(item.id)?.count
  reveal(): void
  mark(grade?: Grade): void // idempotente por markedIds interno
  next(): void; prev(): void
  loadMore(newQueue: NoteRef[]): void // descongela
}

export function createReviewSession(opts: {
  queue: NoteRef[]
  stats: ReadStats
  markRead: (noteId: string, grade?: Grade) => void
}): ReviewSession
```

Interno (no exportado, no testeado directo, pero existe para futuro):

```ts
// seam para intercalado — hoy no se usa
type QueueStrategy = (snap: Snapshot) => NoteRef[]
let frozenQueue: NoteRef[] // la que se congela
let index = 0
let revealed = false // resetea al cambiar index
let markedIds = new Set<string>()
let seen: string[] = [] // back-stack futuro para J, hoy solo se push en next
```

Reglas que la pura debe cumplir (vienen de `src/review/review.tsx`):

- `next`/`prev` clampean `0..length` igual que `src/review/review.tsx:122-123` `Math.min(i+1, queue.length)` / `Math.max(i-1, 0)`.
- Cambiar `index` resetea `revealed=false`, `confirmingDelete` no existe acá (queda en UI).
- `mark` sin `item` o ya `marked` es no-op `src/review/review.tsx:127` `if (!note || marked) return`.
- `mark` es idempotente: segundo `mark` con mismo `id` no llama `markRead` de nuevo (hoy `src/review/review.tsx:102` `markedIds` Set).
- `loadMore(newQueue)` reemplaza `frozenQueue`, `index=0`, `revealed=false` — replica `Cargar más` `src/review/review.tsx:270-273` `setQueue(derived); setIndex(0)`.

Que **NO** va acá: `dialogOpen`, `confirmingDelete` (`src/review/review.tsx:97-98`), `HabitTiles`/`Courses` embeds. Si los metés, el module deja de ser puro y no deep.

## Test

`src/review/review-session.test.ts` — unit puro, sin `renderApp`, sin jsdom pesado:

```ts
import { createReviewSession } from "./review-session"
import { EMPTY_READ_STATS } from "@/core/store/derive"

// factories mínimas locales o de src/test/harness.tsx:36 note()
test("next/prev clampean", ...)
test("cambiar index resetea revealed", ...)
test("mark idempotente no duplica store.save", ...)
test("loadMore descongela y resetea", ...)
test("reads viene de stats.byNote", ...)
```

Mínimo que tiene que fallar si se rompe: `mark` dos veces no duplica, `next` en `done` no pasa de `length`.

## Criterio de done

- [ ] `src/review/review-session.ts` existe con `createReviewSession` pura
- [ ] `src/review/review-session.test.ts` verde con `pnpm test src/review/review-session.test.ts`
- [ ] `src/review/review.tsx` sin cambios funcionales (puede importar pero no usar aún)
- [ ] `pnpm test` 166 verdes — no regresión

## Fuera de scope (gateado)

Intercalado, `seen[]` como back-stack real, `QueueStrategy` con `derive.reviewQueue` — solo el seam vacío. Sigue en `.scratch/retention-system/to-grill-retention-system.md`.
