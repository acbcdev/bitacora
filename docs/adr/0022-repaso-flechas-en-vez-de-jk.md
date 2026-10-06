# ADR 0022 — Repaso navega con ←/→, no con J/K bare

**Status:** Accepted
**Fecha:** 2026-10-05
**Enmienda:** ADR 0017 — su regla "Repaso: bare queda como está (`Enter`/`J`/`K`)" deja de valer para J/K.

## Contexto

ADR 0017 dice "las letras escriben". `J`/`K` en Repaso eran resto de v1: bloqueaban type-to-focus
en el diálogo de Repaso (ADR 0021 unifica el borrador y comparte `NoteBody` con Nota/Notebook).

## Decisión

`J` → `←` (volver), `K` → `→` (siguiente) en `src/review/review.tsx`. Solo actúan con la lista
enfocada (`keysEnabled`: sin dialog ni confirm abierto), así que no pisan el caret del editor.
Los hints `<Kbd>` de las cards y el dialog muestran las flechas.

## Consecuencias

- Ninguna letra a-z es bare en Repaso: el modelo mental de 0017 queda sin excepciones de letra.
- `Enter`, `Space`/chords `g>…` y `N`/`E`/`Del` de Cursos no cambian.
- Divergencia previa, fuera de alcance: 0017 manda el índice de Notebook a `⌘J/⌘K`, pero `notebook-hotkeys.ts` todavía tiene `J/K` bare. En Repaso no importa: la lista embebida corre con `enabled: !embed`.
