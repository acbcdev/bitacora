# 02 — Wirear freeze + navegación al hook

**Status:** bloqueado por `01-pura-review-session`
**Spec:** `.scratch/review-session/spec.md`
**ADR:** `docs/adr/0012-sesion-de-repaso-como-deep-module.md`
**Blocked by:** `01-pura-review-session`
**Toca:** `src/review/review-session.ts` (agrega hook), `src/review/review.tsx:81`, `src/review/review.test.tsx:71`

## Objetivo

Mover el estado efímero de `Review()` al deep module. `Review()` deja de ownar `queue/index/markedIds/revealed` y pasa a renderizar lo que la sesión dice. Freeze pasa de `useEffect` frágil a responsabilidad del module.

## Forma

Agregar al mismo `src/review/review-session.ts`:

```ts
import { useReviewQueue, useMarkRead } from "@/review/review.api"
import { useSnapshot } from "@/core/lib/snapshot"
import { EMPTY_READ_STATS, readStats } from "@/core/store/derive"

export function useReviewSession(): ReviewSession {
  const { data: derived = [] } = useReviewQueue() // src/review/review.api.ts:12
  const { data: stats = EMPTY_READ_STATS } = useSnapshot((s) => readStats(s))
  const markRead = useMarkRead() // src/review/review.api.ts:18
  // interno: frozenQueue, index, revealed, markedIds, seen
  // loadMore = () => setFrozen(derived)
  return createReviewSession({ queue: frozenQueue, stats, markRead: (id,g) => markRead.mutate({noteId:id, grade:g}) })
}
```

En `src/review/review.tsx:81`:

- Borrar `useState queue/index/revealed/markedIds` `src/review/review.tsx:86-102` y `useEffect` freeze `src/review/review.tsx:87-89` y `useEffect` reset `src/review/review.tsx:114-118`. Reemplazar por `const session = useReviewSession()`.
- `next/prev/mark/onEnter` `src/review/review.tsx:122-157` delegan a `session.next/prev/mark/reveal`. `J/K` `src/review/review.tsx:191-192` y `Enter` `src/review/review.tsx:162-167` quedan igual pero llaman `session`.
- `dialogOpen` `src/review/review.tsx:98` y `confirmingDelete` `src/review/review.tsx:97` **se quedan** — no van al module (decisión Q3 del grill).
- `Cargar más` `src/review/review.tsx:270-273` pasa a `onClick={() => session.loadMore()}` — descongela.

Que **NO** tocar: partir cards todavía (eso es 03), ni HabitTiles/Courses embeds `src/review/review.tsx:492-494`.

## Test

Recortar `src/review/review.test.tsx:71-335` a 4-5 integración fina con `src/test/harness.tsx:152` `renderApp`:

- `J/K` delegan sin tocar `read_log`
- `Enter` abre nota sin marcar, `Enter` en dialog gateado a `IntersectionObserver` `src/review/review.test.tsx:103-118`
- Flashcard `Enter` revela, `Correcto` idempotente
- `Cargar más` descongela (nuevo: sembrar `derived` con 3, marcar 1, `Cargar más` trae el 4to)

Todo lo de clamp/idempotencia/revealed reset ya vive en `01-pura` — no duplicar acá. Si un test hace `fireEvent.keyDown` para probar `Math.min`, está mal ubicado: mover a pura.

## Criterio de done

- [ ] `useReviewSession` existe y `Review()` lo usa — no queda `useState` de sesión en `review.tsx`
- [ ] `src/review/review.test.tsx` recortado a ~80 líneas (antes 335), verde con `pnpm test src/review/review.test.tsx`
- [ ] `pnpm test` 166 verdes — no regresión
- [ ] `wc -l src/review/review.tsx` ~300 (antes 497)

## Fuera de scope

Partir `NoteCard`/`FlashcardCard` (03), intercalado/`seen[]` real (gateado retention-system).
