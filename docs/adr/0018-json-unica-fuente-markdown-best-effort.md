# ADR 0018 — El JSON es la fuente de verdad del editor: markdown best-effort

**Status:** Accepted

## Contexto

El editor suma marcas con attrs (color, highlight) y attrs nuevos de tabla (`colwidth`,
`align`) con la UX Notion (`.scratch/editor-notion-ux/`). Las notas se persisten como JSON de
ProseMirror en `notes.content`; markdown es solo export/copy/download y paste de texto plano
(`src/core/lib/tiptap-markdown.ts`, serializador propio, GFM subconjunto).

El round-trip markdown no puede representar color (no hay sintaxis md) ni `align`/`colwidth`
(el GFM propio no emite `:` de alineación ni colwidth). Ya HOY `align` se pierde en ese
camino: exportar → re-importar es con pérdida, por diseño.

## Decisión

**El JSON es la única fuente de verdad; el markdown queda best-effort, sin cambios.**

- Persistencia: `editor.getJSON()` → `notes.content`, tal como hoy. Las marcas nuevas
  sobreviven solas (`marks: [{ type, attrs }]`); los attrs nuevos de tabla aplican defaults
  cuando el JSON no los trae — **no hay migración** de notas existentes.
- Export/copy/download `.md`: queda como está. Color/highlight/align se pierden en ese
  fragmento si sale y vuelve a entrar, igual que hoy pierde align. Quien pega markdown de
  vuelta acepta texto plano.
- No se agrega HTML embebido al export (rompe la portabilidad del md) ni se adopta
  `@tiptap/markdown` oficial (dep nueva + reescritura del round-trip de tests).

## Consecuencias

- Cero build en persistencia; los tests existentes del round-trip quedan intactos.
- El `.md` exportado NO sirve como backup con fidelidad de formato — si el export se vuelve
  camino real de migración/backup, se reabre (opción HTML embebido en el serializador propio
  o la extensión oficial, ver ticket 06 con las tres opciones costeadas).
- Los nodos nuevos no serializan nada al JSON: drag-handle es plugin/decoración DOM, no nodo.

## Alternativas descartadas

- **HTML embebido en el md**: conserva color a costa de un export menos portable; build +
  tests, para un camino que hoy es solo sharing.
- **`@tiptap/markdown` oficial (3.31.3)**: mayor cobertura, pero reemplaza ~430 líneas
  propias cubiertas por tests y cambia edge cases de paste (listas pegadas de ChatGPT/Claude,
  tablas irregulares — ya cubiertas). Sin beneficiario real.
