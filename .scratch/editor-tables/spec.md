# Spec — Tablas en el Editor (render read-only)

**Status:** ready-for-agent
**Feature:** `editor-tables`
**Glosario:** `CONTEXT.md` — Note (`content` TiptapDoc), Snapshot, Store, Derivación
**Stack:** Tiptap (`StarterKit` + `CodeBlock` + `Image` + nuevo `Table` family) + `lowlight` (no cambia)
**Origen:** `.scratch/backlog/to-grill-backlog.md` #3 — "el editor soporata tablas ?"

## Problem Statement

El Editor Tiptap actual no soporta tablas. La importación de Notion aplana bloques `table`/`table_row`/`table_cell` a texto plano (`blocks-to-tiptap.ts` — "Bloques Notion-only sin equivalente se aplana"). Si la nota original tenía una tabla comparativa o de datos, hoy se ve como líneas de texto sin estructura, perdiendo semántica y legibilidad. No hay forma de pegar Markdown de tabla (`| a | b |`) y que se renderice como tabla. El usuario pregunta si el editor soporta tablas y si debería.

## Solution

Agregar soporte de tablas **solo para render** (read-only con edición mínima), no edición completa. Tablas importadas de Notion y pegadas en Markdown se renderizan como `table` HTML real dentro del `TiptapDoc`. Se pueden editar contenidos de celdas (texto) como cualquier nodo, pero no se ofrece toolbar para insertar/borrar filas/columnas ni merge. Es decir: la tabla es contenido, no un spreadsheet. Si se necesita crear una tabla nueva desde cero, se hace pegando Markdown `|...|` que el `handlePaste` convierte a nodos de tabla. Sin chrome extra (respeta `ui-principles` #3 chrome mínimo). En mobile, la tabla hace scroll horizontal.

## User Stories

1. As a estudiante con nota importada que tenía tabla de 3×4 en Notion, I want verla como tabla HTML con bordes y headers, so that no tenga que reconstruirla a mano.
2. As a usuario que pega `| a | b |\n|---|---|` en el Editor, I want que se convierta en tabla real, so that pueda crear tablas sin toolbar.
3. As a usuaria en mobile, I want una tabla ancha haga scroll horizontal sin romper el layout, so that la nota siga legible.
4. As a estudiante con nota con tabla de precios, I want poder editar el texto de una celda (doble click, tipear), so that corregir un dato no requiera recrear la tabla.
5. As a usuario que selecciona texto de una tabla y lo copia, I want que el copy conserve tabs o Markdown, so that pegar fuera siga útil.
6. As a usuario con nota sin tablas, I want nada: el Editor no muestra botones de tabla ni ocupa espacio, so that el chrome siga mínimo.
7. As a usuario que imprime o exporta la nota (futuro), I want la tabla sea `<table>` semántico, so that sea accesible.
8. As a developer, I want `notes.content` siga siendo `TiptapDoc` JSON sin migración, so that notas viejas sin tablas sigan abriendo.
9. As a developer, I want `blocks-to-tiptap` convierta bloques `table` de Notion a nodos de tabla en vez de aplanar, so that re-importar recupere tablas perdidas.
10. As a QA, I want un script que cuente cuántas notas perdieron tablas al aplanar, so that se valide el impacto antes de re-importar.

## Implementation Decisions

- **Extensiones Tiptap:** Agregar `@tiptap/extension-table` + `TableRow` + `TableHeader` + `TableCell`. Config: `resizable: false` en v1 (evita handles de resize que añaden chrome y complejidad). `StarterKit` sigue con `codeBlock: false` + `CodeBlock` custom + `Image` + nuevas 4. No se añade `TableCell` merging ni `BubbleMenu` de tabla.
- **Edición limitada:** Las celdas son editables como texto (bold/italic/listas no dentro de celda en v1 — solo texto plano con inline marks). No hay comandos `addRowBefore`/`deleteColumn` expuestos en UI. Si el usuario quiere estructura distinta, edita fuera (pega nueva tabla). Esto evita toolbar de tabla que choca con `ui-principles` y evita `gapcursor` quirks.
- **Paste Markdown:** Extender `handlePaste` y `markdownToDoc` para reconocer tablas GitHub Flavored Markdown (`| a | b |`). Si el texto pegado contiene una tabla, convertirla a nodos `table` en vez de párrafos. `tiptap-markdown` o `markdown-it` ya puede parsear tablas; usar el mismo path que headers/listas. Sin esto, pegar tablas seguiría aplanado.
- **Import Notion:** Cambiar `scripts/notion-import/blocks-to-tiptap.ts` para que bloques `table`/`table_row`/`table_cell` generen `type: "table"` en vez de texto. Re-importar es opcional; notas ya aplanadas quedan como texto a menos que se reimporte. No hay migración automática de `notes.content` viejas (se deja como está).
- **Estilos:** Añadir CSS para `table` en `tiptap-host`: `border-collapse`, `border: 1px solid --border`, `th` con `bg-muted` y `font-semibold`, `td/th` con `padding` y `min-width`. Wrapper `overflow-x-auto` para scroll horizontal en mobile. No se añade `caption`.
- **Sin schema change:** `notes.content` sigue `TiptapDoc` (JSON). Una tabla es `type: "table"` con hijos `tableRow`/`tableCell`, que ya es estándar Tiptap. No toca `courses`/`habit_log`/`read_log` ni `Snapshot`.
- **Accesibilidad:** `table` semántica con `th` para header row si la primera fila viene de Markdown header. `role` no necesario.
- **Seam elegido:** Uno solo — **Editor** (Tiptap schema + paste handler). Es el seam más alto: todo `note.content` pasa por él. No se añade seam nuevo. La derivación (`derive.ts`) y `Store` no se tocan (tabla es contenido, no hecho derivado).
- **Alternativa rechazada:** Edición completa con toolbar (add/delete row/col, merge) — más útil pero rompe chrome mínimo y en mobile necesita `overflow` + `BubbleMenu` + tests extra. Rechazado en grill Q8=A. Alternativa texto preformateado (bloque de código) descartada porque pierde semántica y scroll.

## Testing Decisions

- **Qué hace un buen test:** Render de tabla como `<table>` con contenido correcto, paste que genera tabla, y que el Editor siga editable sin toolbar. No testear estilos pixel-perfect ni resizing.
- **Qué se testea:**
  - Unit paste: `tiptap-markdown.test.ts` — `markdownToDoc("| a | b |\n|---|---|\n|1|2|")` contiene `type: "table"` con 2 rows. Prior art: `tiptap-markdown.test.ts` (headers, bold, listas).
  - Integración Editor: `editor.test.tsx` — render `Editor` con `TiptapDoc` que tiene tabla, verificar `role="table"` o `table` en DOM, editar celda `userEvent.type` y verificar `onChange` contiene texto nuevo. Prior art: `editor.test.tsx` (paste Markdown, focusEnd) + `code-block.test.tsx` (NodeView).
  - Import script: test de `blocks-to-tiptap` con fixture Notion `table` block → `TiptapDoc` table. Prior art: `local-store.test.ts` fixture style.
  - Mobile scroll: verificar wrapper tiene `overflow-x-auto` (snapshot leve).
- **Seam de test:** `markdownToDoc` puro + `Editor` con `content` sintético. No Store, no Snapshot.
- **Out of test:** Resize de columnas, bubble menu, `blocks-to-tiptap` re-import masivo.

## Out of Scope

- Toolbar de tabla (insertar/borrar fila/columna, merge cells, header toggle). v2 si se pide edición completa.
- `resizable: true` con handles de drag.
- Soporte de `colspan`/`rowspan` (v1 solo grid regular).
- CSV import o `table` desde HTML pegado (solo Markdown y Notion blocks).
- Migración automática de notas ya aplanadas (quedan como texto; re-import manual si se quiere).
- Estilos print/export dedicados.

## Further Notes

- Verificar antes de implementar: correr conteo sobre `notes.content` existentes cuántas contienen `type: "table"` (0 hoy) y cuántas notas de Notion tenían `table` blocks que se aplanaron. El conteo define si re-importar vale la pena.
- Si una tabla tiene 1×1, se renderiza igual (no se colapsa a párrafo).
- No se añade entrada de glosario: tabla es concepto genérico, no dominio de estudio.
- Si en el futuro se quiere crear tabla desde slash `/table`, añadir comando `insertTable` es trivial sobre estas extensiones sin tocar spec.
