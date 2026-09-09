# 03 — Partir `NoteCard` / `FlashcardCard`, `Review()` a ~150 líneas

**Status:** bloqueado por `02-wire-freeze-navegacion`
**Spec:** `.scratch/review-session/spec.md`
**ADR:** `docs/adr/0012-sesion-de-repaso-como-deep-module.md`
**Blocked by:** `02-wire-freeze-navegacion`
**Toca:** `src/review/review.tsx:81`, nuevos `src/review/note-card.tsx`, `src/review/flashcard-card.tsx` (nombres a confirmar en el PR)

## Objetivo

`Review()` deja de ser un Cristo de 497 líneas que hace 5 trabajos y pasa a ser composición: sesión + 2 cards tontos + embeds. Locality completa.

## Forma

Extraer lo que hoy vive en `src/review/review.tsx:284-339`:

```tsx
// src/review/note-card.tsx — tonto, sin estado
export function NoteCard({ item, course, openNote, onOpen }: {
  item: NoteRef; course?: Course; openNote?: Note; onOpen: () => void
}) {
  // título line-clamp-2, preview line-clamp-3, overlay button absolute inset-0
  // — replica src/review/review.tsx:292-314 pero sin useState
}

// src/review/flashcard-card.tsx — tonto, recibe revealed
export function FlashcardCard({ item, course, openNote, revealed, marked, onReveal, onMark }: {
  item: NoteRef; course?: Course; openNote?: Note
  revealed: boolean; marked: boolean
  onReveal: () => void; onMark: (g: Grade) => void
}) {
  // h1 pregunta, Editor si revealed, botones Incorrecto/Parcial/Correcto
  // — replica src/review/review.tsx:318-337
}
```

`src/review/review.tsx:81` queda:

```tsx
export function Review() {
  const session = useReviewSession()
  const { data: courses } = useCourses()
  const { data: openNote } = useNote(session.item?.id)
  const [dialogOpen, setDialogOpen] = useState(false) // queda
  // ...J/K/Enter delegan a session, hotkeys igual
  return (
    <div>
      <Progress ... />
      <Card>
        {session.done ? <Empty ... onLoadMore={session.loadMore} /> :
         session.item.kind === "note" ? <NoteCard ... /> : <FlashcardCard ... />}
      </Card>
      {session.item?.kind==="note" && <NoteDialog ... />}
      <HabitTiles />
      <Courses embed />
    </div>
  )
}
```

No mover `HabitTiles` `src/review/review.tsx:492` ni `Courses` `src/review/review.tsx:494` adentro de sesión — son composición, no sesión (decisión Q1 del grill). No tocar `src/core/store/derive.ts`.

Estilo: `FOOTER_BTN` `src/review/review.tsx:73` y `ReadHistory` `src/review/review.tsx:40` se quedan en `review.tsx` o se co-locan con cards según el PR — no inventar `src/review/styles.ts`.

## Test

- `src/review/note-card.test.tsx` y `flashcard-card.test.tsx` — 2-3 render tests cada uno (que renderiza título, que `Revelar` llama `onReveal`). Nada de `fireEvent.keyDown` — eso ya es de sesión.
- `src/review/review.test.tsx` — se mantiene verde sin tocar, ahora testa composición (que `Review` renderiza la card correcta según `session.item.kind`).

## Criterio de done

- [ ] `NoteCard` y `FlashcardCard` existen, sin `useState` de sesión
- [ ] `src/review/review.tsx` ~150-180 líneas (`wc -l src/review/review.tsx`)
- [ ] `pnpm test src/review/review.test.tsx` + nuevos card tests verdes
- [ ] `pnpm test` 166 verdes — no regresión
- [ ] `grep -n "useState.*queue\|useState.*index\|useState.*markedIds" src/review/review.tsx` vacío — sesión ya no vive en render

## Fuera de scope

Intercalado/`seen[]` real, cambios a `derive.reviewQueue`, migración harness 6 fakes restantes (candidato 02 del architecture review) — se trackea aparte, no bloquea este issue.
