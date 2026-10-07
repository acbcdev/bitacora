# Commit en piezas el diff acumulado

**Status:** done

## Problema

Hay ~590 líneas de diff sin commitear repartidas en 7 archivos (`block-controls.tsx` +399,
`bubble-menu`, `table-controls`, `index.css`, `CONTEXT.md`) más sin trackear:
`.scratch/habit-tile-deepening/`, `.scratch/note-draft-unify/`, `.scratch/review-session-advance/`,
`docs/adr/0020-*.md`, `docs/adr/0021-*.md`. Cuanto más acumula, más difícil partirlo después.

## Fix esperado

Commits chicos por tema, en orden de dependencia:

1. ADRs + `.scratch/` nuevos (docs, sin riesgo).
2. `block-controls.tsx` + su test (van juntos).
3. `bubble-menu.tsx` + su test.
4. `table-controls.tsx`.
5. `index.css` (estilos del halo,probablemente con 2).
6. `CONTEXT.md` al final o junto al tema que le corresponda.

Cada commit corre pre-commit; si 05 aterriza antes, es ~5s por piece en vez de ~30s.
