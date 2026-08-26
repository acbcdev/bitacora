# 0012 — Sesión de repaso como deep module

**Fecha:** 2026-08-26
**Estado:** aceptada
**Reabre:** nada (complementa ADR 0011 y ADR 0003)
**Relacionado:** CONTEXT.md “Cola de repaso” / “Sesión de repaso” / “Cola one-by-one (NO construido)”, `docs/adr/0011-store-adapter-supabase-o-localstorage.md`, `docs/adr/0003-derive-everything-from-read-log.md`, `.scratch/retention-system/to-grill-retention-system.md`

## Contexto

`src/review/review.tsx` son 497 líneas con 6 piezas de estado efímero (`queue`, `index`, `revealed`, `confirmingDelete`, `dialogOpen`, `markedIds:86-102`) + 2 effects + `next/prev/mark/onEnter:122-167` tejido entre dos renders de card (Nota vs Flashcard) y dos embeds (`HabitTiles:492`, `Courses:494`).

El congelado del batch vive en un `useEffect` frágil `src/review/review.tsx:86-89`:

```ts
setQueue((prev) => (prev.length === 0 && derived.length > 0 ? derived : prev))
```

Funciona pero esconde la regla: el batch se toma una vez al montar y solo `Cargar más:270-273` lo descongela. Marcar leído invalida el `Snapshot` (`store.save("read_log")` → `["snapshot"]`), y sin freeze la cola se reordenaría abajo del usuario.

El test surface es el DOM `src/review/review.test.tsx:335` — 423 líneas haciendo `fireEvent.keyDown` para probar aritmética de `Math.min(i+1, length)` y idempotencia de `markedIds`. Lento y frágil. La interfaz **no** es testeable sin montar `QueryClient` + `TooltipProvider` + `MemoryRouter` (`src/test/harness.tsx:152`).

El glosario ya reserva el vocabulario (`CONTEXT.md:64-65`): **Cola de repaso** (construida, batch 3) vs **Cola one-by-one** (no construida, 1-a-la-vez con intercalado y `seen[]`). El reporte `architecture-review-20260825` candidato 03 dice explícito: *“El module se llama como el glosario, no ReviewManager”*.

## Decisión

Extraer **Sesión de repaso** como deep module en `src/review/review-session.ts`:

**Frontera:** solo la máquina de la cola. No los cards, no HabitTiles, no Courses. `Review()` queda composición de sesión + `NoteCard`/`FlashcardCard` tontos.

**Interfaz chica, test surface:**

```ts
type ReviewSession = {
  item: NoteRef | null
  position: string // "2 / 3" | ""
  index: number; length: number; done: boolean
  revealed: boolean
  marked: boolean
  reads: number
  reveal(): void
  mark(grade?: Grade): void // idempotente por markedIds interno
  next(): void; prev(): void // clamp 0..length
  loadMore(): void // descongela: toma derived fresco, reset index/revealed
}

// Pura — sin React, sin Store, testeable con spy
function createReviewSession(opts: {
  queue: NoteRef[]; stats: ReadStats; markRead: (noteId: string, grade?: Grade) => void
}): ReviewSession

// Hook fino — único que cruza el seam Store
function useReviewSession(): ReviewSession
// Internamente: useReviewQueue() + useSnapshot(readStats) + useMarkRead()
```

**Qué esconde:** `queue` congelada, `markedIds` (`Set<string>` `src/review/review.tsx:102`), `seen[]` (back-stack futuro para `J` cuando sea one-by-one), `QueueStrategy` interno (`(snap) => NoteRef[]`, hoy `reviewQueue(s,3)`, futuro `reviewQueueOneByOne`). Nada de esto se expone.

**Qué NO esconde:** `dialogOpen` y `confirmingDelete` quedan en `Review()` — son UI del dialog, no de la sesión. Si entran, el module deja de ser testeable sin DOM.

**Ubicación y dependencias:** `src/review/review-session.ts` (feature, no `src/core/store/`). Importa de `derive.ts` (`reviewQueue`, `ReadStats`), no al revés. No importa `store` directo: recibe `markRead` inyectado. Así la pura sigue pura, igual que `deriveHabit` `src/core/store/derive.ts:323` recibe `rows` sin saber de adapter.

**Intercalado futuro:** NO se implementa ahora. El seam interno (`seen[]` + `QueueStrategy`) ya existe vacío para que la Cola one-by-one entre sin tocar JSX ni `Review()`. Construirla es otro ADR/spec (`.scratch/retention-system/`).

## Consecuencias

- `src/review/review.tsx` pasa de 497→~150 líneas: render puro de lo que la sesión dice. Locality: freeze, idempotencia y `revealed` reset viven en un lugar.
- Test surface se parte: `src/review/review-session.test.ts` unit puro (clamp, `revealed` reset por `index`, idempotencia, `loadMore`) + `src/review/review.test.tsx` recortado a 4-5 integración DOM (que `J/K/Enter` delegan, que `NoteDialog` gatea `Enter` hasta `IntersectionObserver`, que `ConfirmDelete` no roba `Enter`). Leverage: 1 interfaz, N tests.
- `derive.reviewQueue` sigue siendo la única fuente de orden. La sesión es el cursor sobre esa cola.
- Glosario actualizado: nuevo término **Sesión de repaso**, ajuste a **Cola de repaso** (“su recorrido y freeze los ownéa la Sesión”) y a **Cola one-by-one** (“cuando se construya, vive dentro de la Sesión vía QueueStrategy”).
- Cuando se implemente one-by-one, el diff es interno al module: `Review()` y cards no cambian.

## Alternativas descartadas

**1. “ReviewManager” que ownéa renders + embeds.** Rechazada: acopla navegación con JSX, no podés testear intercalado sin jsdom, viola `docs/ui-principles.md` #3 (chrome mínimo) y es el mismo error que ADR 0011 v1 (22 métodos, 1 por query = transliteración, no abstracción). Shallow por definición.

**2. Meter la sesión en `src/core/store/derive.ts`.** Rechazada: `derive.ts` son funciones puras `Snapshot → hechos` sin React ni mutaciones (`src/core/store/derive.ts:12`). Mezclar estado efímero + `store.save` contamina la derivación y rompe “una regla, un lugar” de ADR 0011.

**3. Ponerla en `src/core/lib/`.** Rechazada: falso reuso. Ningún otro feature recorre una cola de repaso. Solo agrega un hop de navegación.

**4. Implementar intercalado + `seen[]` ya.** Rechazada: `CONTEXT.md:65` dice explícito *“la RPC no toma argumentos y review.tsx no tiene seen[]”* — no hay spec cerrado de `review_queue(exclude_*)`. A 59 cursos y `REVIEW_BATCH=3` `src/review/review.api.ts:7` el beneficio no paga la especulación. YAGNI con seam preparado es el tradeoff correcto.

**5. Big bang 497→150 en un PR.** Rechazada: diff ilegible, no verificable en el medio. Se corta en 3 tracer-bullets `.scratch/review-session/issues/` cada uno shippable y con criterio de done propio.

## Qué deja gateado

Intercalado forzado, `seen[]` como back-stack, `review_queue(exclude_*)` con fallback, y cualquier cambio a `reviewQueue` para servir 1-a-la-vez. Siguen en `.scratch/retention-system/to-grill-retention-system.md` hasta que haya spec y ADR propio. Si aparece en S1-S3, se rechaza por scope creep (`CONTEXT.md:145` “Fuera del MVP”).

## Verificación

- `pnpm test src/review/review-session.test.ts` — unit pura verde sin jsdom pesado
- `pnpm test src/review/review.test.tsx` — integración fina verde con `src/test/harness.tsx:152` `renderApp`
- `pnpm test` — 166 tests verdes (baseline `2026-08-25`)
- `wc -l src/review/review.tsx` — ~150-180 líneas tras S3
