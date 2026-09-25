# 04 — Contrato de tablas finas

Type: grilling
Status: resolved
Blocked by: 01

## Question

¿Cómo se edita una tabla al estilo Notion? Botones + para añadir filas/columnas, handle para seleccionar fila/columna y su menú (insertar, eliminar, mover izquierda/derecha/arriba/abajo, duplicar), toggle de header, alineación si aplica, y qué pasa en modo lectura. Decide si las tablas pasan a `resizable: true` o quedan de ancho fijo.

## Answer

Contrato cerrado (grill 2026-09-26, spec historia 5):

- **`resizable: true`** (decisión del usuario). Sin migración: `colwidth` es attr con default null, solo nace al editar (ticket 06). Sin resize de filas (no existe en la extensión).
- **Dos `+` por hover** estilo Notion: hover de fila → `+` a la derecha del borde (`addColumnAfter`); hover de columna → `+` bajo el borde (`addRowAfter`). Overlay absoluto sobre el host, mismo patrón que `Outline`. `Tab` en última celda crea fila (default, queda).
- **Handles con `DropdownMenu` de shadcn:** `⋮⋮` (fila, borde izquierdo): insertar arriba/abajo, duplicar, eliminar. `▾` (columna, borde superior): insertar izquierda/derecha, duplicar, eliminar, toggle header (`toggleHeaderColumn`/`toggleHeaderRow` en los menús, no botones sueltos).
- **Duplicar = build propio** (clone vía JSON del nodo + insert). **Alineación fuera**: `align` ya no round-tripea (ticket 06); se reabre solo si el round-trip se extiende.
- **Modo lectura: NO EXISTE** (decisión del usuario en grill). El editor siempre edita; el dialog de Repaso ya edita con autosave; la flashcard expandida será texto simple, no editor. Ver historia 7 de la spec.
