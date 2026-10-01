# ADR 0021 — Un solo Borrador de nota: `useNoteDraft` sirve a la pantalla Nota y al dialog de Repaso

**Status:** Accepted
**Fecha:** 2026-10-01
**Enmienda:** ADR 0015 — extiende la semántica del borrador a una segunda superficie. El reset por id y "el draft local es la autoridad" no cambian; simplemente dejan de tener dos implementaciones.

## Contexto

El autosave del `NoteDialog` (`src/review/note-dialog.tsx`, nota editable dentro del diálogo de Repaso, historia 7 de editor-notion-ux) es **la misma regla de negocio** que `useNoteDraft` (`src/notes/notes.api.ts`): debounce de 800 ms, refs `latest`/`doc`, flush al desmontar, reset al cambiar de nota. En vez de reusarse, el diálogo la implementa duplicado — otro timer, otro ref `pending`, otro `flush()` (review `architecture-review-20260929`, candidato 2). Un fix de bug en uno no llega al otro; el diálogo va a necesitar los mismos bugs que ya resolvió ADR 0015 (reset por id, orden del offload).

## Decisión

**Un solo módulo, sin flags:**

```ts
useNoteDraft(id: string | null, open = true)
// → { note, title, savedAt, onTitleChange, onDocChange, flush() }
```

- Pantalla Nota y dialog de Repaso son **dos adapters de la misma interfaz**; la regla de autosave vive en un solo lugar.
- **El título es siempre editable** en ambas superficies (grill 2026-10-01) — no hay diferencia entre superficies, así que no existe `editableTitle?: boolean`. Si algún día el diálogo necesita título congelado, se agrega ese día (YAGNI).
- El diálogo deja de tener timer/refs/pending propios; llama `flush()` del hook al cerrar.
- ADR 0015 aplica automáticamente al diálogo: reset por `id`, draft local autoritario, eco del server pisado.

## Consecuencias

- Se borran ~40 líneas duplicadas de `note-dialog.tsx`.
- Un fix de autosave cubre ambas superficies por ser el mismo módulo (leverage 1 hook, 2 superficies; locality 1 lugar).
- ADR 0015 deja de ser recordatorio manual para el que toca el diálogo.

## Alternativas descartadas

1. **Hook con flag `editableTitle`** — config para una diferencia que hoy no existe; rama condicional sin cliente.
2. **Dejar el duplicado** — dos implementaciones de la misma regla que ya se desincronizaron una vez (`75b3336`).

## Qué deja gateado

Edición concurrente real (dos superficies sobre la misma nota a la vez) — descartada como anti-YAGNI por ADR 0015; si aparece, ese ADR se reabre con merge por `updated_at`.

## Verificación

- `pnpm test src/notes` — el hook sigue verde, ahora con el caso del diálogo cubierto (flush al cerrar, reset por id).
- `pnpm test src/review/review.test.tsx` — editar en el diálogo autosavea y marca leída sin perder el flush.
- `pnpm test` — baseline verde.
