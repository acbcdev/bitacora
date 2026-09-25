# 06 — Persistencia: round-trip markdown y notas existentes

Type: research
Status: resolved
Blocked by:

## Question

¿Cómo sobrevive todo lo nuevo al guardar? Las notas se serializan con `tiptap-markdown` (`src/core/lib/tiptap-markdown.ts`). Verificar: ¿qué pasa con un mark de color en round-trip markdown (¿se pierde, hay que serializar como HTML o metadato?), ¿cómo serializa drag-handle (nada en el doc), y qué migración necesitan las notas ya guardadas si cambian atributos de tabla? Salida: hechos + opciones para la spec, sin decidir UX.

## Answer

### Hallazgo principal: el nombre del archivo engaña

El repo **no usa la librería npm `tiptap-markdown`**. `src/core/lib/tiptap-markdown.ts` es un serializador/parser Markdown↔Tiptap JSON **propio** (~430 líneas, subconjunto GFM; el comment del propio archivo lo dice: "No es CommonMark completo a propósito"). No hay ningún paquete markdown de Tiptap en `package.json`.

### Hecho 1 — Cómo se guarda el contenido hoy

- **Fuente de verdad: JSON de ProseMirror en `notes.content`** (Supabase). `TiptapDoc = { type: "doc"; content?: unknown[] }` (`src/core/types/database.ts:13-14`). Se guarda tal cual desde `onUpdate → editor.getJSON()` (`editor.tsx:105-108`); no hay validación de schema al guardar.
- **Markdown es solo export/copy y paste**: `docToMarkdown` para copiar/descargar (`src/notes/note-actions.tsx:94`, `downloadMarkdown`), `markdownToDoc` para pegar texto plano con sintaxis md (`editor.tsx:176,297`) e `insertMarkdownAtStart`.
- **Consecuencia para el mark de color y attrs de tabla**: al persistir, un mark nuevo con attrs (color) y attrs nuevos de tabla (colwidth, align) **sobreviven solos** — el JSON los guarda como `marks: [{ type, attrs }]` y `attrs`. El round-trip en riesgo es únicamente **export md → re-import / paste**, no el guardado en la nota.
- **Tablas hoy**: `Table.configure({ resizable: false })` (`editor.tsx:90-99`) → el JSON guardado no tiene `colwidth` (default `null` ni se genera). La extensión instalada (`@tiptap/extension-table`) declara en cells/headers: `colspan`, `rowspan`, `colwidth` (default null, parseado desde attr HTML), `align` (default null, parseado de style/attr).
- El serializador custom emite solo `---` en el separador (sin `:` de alineación) y el parser ignora la alineación (`isDelimiter` solo valida caracteres) → **align de celda ya hoy no round-tripea** ni en export ni en paste. `tableToMarkdown` no emite colwidth.
- **Drag-handle**: no existe en el repo (no está en las extensions ni en node_modules). Cuando se implemente, será plugin/decoración DOM — no añade nodos al doc, **no hay nada que serializar**.

### Hecho 2 — Color mark en round-trip markdown

- **Librería comunitaria** ([aguingand/tiptap-markdown](https://github.com/aguingand/tiptap-markdown)): usa `prosemirror-markdown`; **un mark sin spec de serialización se descarta silenciosamente** en el export ([default serializer](https://github.com/ProseMirror/prosemirror-markdown/blob/master/src/to_markdown.ts#L66)). Para conservarlo hay que añadir serializer/parser custom, o serializarlo como HTML (con `html: true`, default, los tags HTML round-tripan vía parseHTML del mark). Su README avisa: **desde Tiptap 3.7 existe la extensión markdown oficial y el paquete no se mantiene**.
- **Extensión oficial** ([`@tiptap/markdown`](https://registry.npmjs.org/@tiptap/markdown) — 3.31.3, MIT, deps `@tiptap/core ^3.x`: compatible con el 3.28/3.31 instalado; docs: [tiptap.dev/docs/editor/markdown](https://tiptap.dev/docs/editor/markdown)): built on `marked` (no markdown-it). Misma situación: un mark sin `renderMarkdown` **se serializa a `""`** (se pierde, `dist/index.js:1072`). Tokens HTML del md round-tripan vía `generateJSON` + DOMParser (`index.js:888-893`); HTML no reconocido queda como texto literal.
- El mark vendría de `@tiptap/extension-text-style` (TextStyle + Color) — no instalado; el StarterKit 3.28 instalado incluye underline y link pero no textStyle.

### Hecho 3 — API concreta para serialización custom

- **Comunitaria** ([ejemplos](https://github.com/aguingand/tiptap-markdown/tree/main/example/src/extensions)): en el propio Node/Mark, `addStorage(): { markdown: { serialize, parse } }`. Dos formas:
  - mark inline: `serialize: { open: '==', close: '==' }` + `parse: { setup(markdownit) { markdownit.use(plugin) } }` (ej. `highlight.js` con `markdown-it-mark`).
  - nodo block: `serialize(state, node) { state.write(...) ; state.renderContent(node); state.closeBlock(node) }` + plugin markdown-it (ej. `container.js`).
- **Oficial `@tiptap/markdown`** (inspeccionado el dist 3.31.3): la extensión declara campos `markdownName`, `parseMarkdown(token, helpers)` y `renderMarkdown(node, helpers, context)` (resueltos vía `getExtensionField`, `registerExtension`). Helpers: `renderChildren`, `renderChild`, `indent`, `wrapInBlock`. Config: `Markdown.configure({ indentation, marked, markedOptions })`; salida `editor.getMarkdown()`; paste/copy md con `transformPastedText`/`transformCopiedText`.
- **Repo (custom propio)**: `block()`/`parseBlocks()` son switches — añadir un caso por nodo/mark nuevo (y `inline()`/`parseInline()` para marks). El comment del archivo ya lo documenta.

### Hecho 4 — Compatibilidad hacia atrás con notas existentes

- **No hay migración que hacer al añadir attrs**: Tiptap aplica los defaults declarados en `addAttributes` cuando el JSON no trae el attr (`colwidth: null`, `align: null`). Notas viejas sin colwidth/align cargan sin cambios; el type `TiptapDoc` (`content?: unknown[]`) no valida nada. Activar `resizable: true` solo crea attrs al editar, no toca notas existentes.
- **El riesgo real está en el path markdown**: lo que se exporta a `.md` (copy/download) y lo que entra por paste NO puede representar color (no hay sintaxis md), ni alineación ni colwidth (el GFM del custom no emite `:`). Si una nota sale y entra por ese path, se pierden — igual que hoy pierde align. Con HTML embebido en el md se conserva, pero el export deja de ser markdown portable en esos fragmentos.
- **Paste no rompe**: `markdownToDoc` ignora lo desconocido; HTML pegado como texto plano (spans) se inserta literal (INLINE_RE no matchea HTML). El paste rico (`text/html`) ya hoy no pasa por el parser custom (`editor.tsx:173`).
- Nota: la línea "Persistencia" de `map.md` dice "las notas se guardan via tiptap-markdown" — impreciso: se guardan como JSON; markdown es solo export/paste.

### Opciones de persistencia para la spec

1. **JSON como única fuente de verdad, markdown "best effort" (sin cambios)**: color/attrs viven solo en el JSON; el export md se queda como está (color y align se pierden solo en export/reimport). Cero dependencias, cero migración, tests actuales intactos.
2. **Round-trip con HTML embebido en el markdown**: extender el serializador custom para emitir `<span style="color:...">` (y alineación/colwidth si se pide) y enseñar a `parseInline`/paste a aceptar esos spans vía parseHTML del mark. Sin dependencias nuevas; el export pierde portabilidad pura en fragmentos con color.
3. **Reemplazar el custom por `@tiptap/markdown` oficial**: mayor cobertura (paste md transformado, copy como md, HTML round-trip) y marks custom vía `renderMarkdown`/`parseMarkdown`. Coste: dependencia nueva + reescribir/ajustar los tests del round-trip (`tiptap-markdown.test.ts`) y riesgo de diferencias de edge cases con el parser propio (listas pegadas de ChatGPT/Claude, tablas irregulares — ya cubiertas por tests).
