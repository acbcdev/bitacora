# ADR 0024 — Atajos que no chocan con el browser

**Status:** Accepted
**Fecha:** 2026-10-15
**Enmienda:** ADR 0017 — cambia las teclas `mod+` de Nota/Notebook, no la regla "las letras escriben".

## Contexto

Audit de todos los hotkeys contra Chrome, Safari y Firefox:

- `⌘N` (nueva nota) nunca llegaba a la app: Chrome y Firefox reservan `⌘/Ctrl+N/T/W`, y
  `preventDefault` no los frena.
- `⌘←/⌘→` (alias de nav del índice, con `enableOnContentEditable`) se robaba el inicio/fin de línea
  del editor en mac y el salto de palabra con `Ctrl+←/→` en Windows.
- `⌘K` disparaba la palette **y** la nav del índice a la vez: los dos están registrados y
  `preventDefault` no frena al otro listener.
- `⌘F` (focus mode) mataba el find nativo del browser en Nota.

## Decisión

- Nav entre notas del Notebook: `⌥J` / `⌥K`. Los alias `⌘J/K` y `⌘←/→` se borran.
- Nueva nota: sin tecla. Queda el botón y "Nueva nota" en ⌘K (solo dentro de un notebook).
- Focus mode: `⌘⇧F`.
- Regla para atajos futuros: nada reservado por el browser, nada que pise find o la edición de
  texto del OS, y nada de `⌥` + dead key de macOS (`E`, `N`, `U`, `I`, `` ` ``): matan á/ñ/ü, y la
  lib matchea por `e.code`.

## Consecuencias

- Cheatsheet, palette y los hints `<Kbd>` muestran las teclas nuevas (`alt()` en `core/lib/utils`).
- Quedan por verificar en el browser: `⌘⌥B` (bold, en Chrome mac es el Bookmark Manager) y `⌘,`
  (Ajustes, en Safari puede ganar el menú de preferencias).
