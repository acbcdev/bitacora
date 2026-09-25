# 01 — Inventario de capacidades Tiptap v3

Type: research
Status: resolved
Blocked by:

## Question

¿Qué de la experiencia Notion nos da Tiptap v3 oficialmente y qué toca construir? Inventario concreto de: utilidad `Suggestion` para menú slash, `BubbleMenu` de @tiptap/react, extensiones drag-handle / node-range (@tiptap/extension-drag-handle), menú de tablas en @tiptap/extension-table 3.31, marcas de color/highlight (¿custom mark o highlight oficial?), y coste aproximado de lo que falte. Base para los contratos de UX de los tickets 02–05.

## Answer

Inventario verificado contra npm registry y tiptap.dev (docs 3.x) — todo existe, última versión común **3.31.3**. El repo hoy tiene @tiptap/react ^3.28.0, starter-kit ^3.28.0, table ^3.31.3; faltan instalar: suggestion, drag-handle(+react), node-range, color/text-style, highlight.

### 1. Menú slash — `@tiptap/suggestion` (3.31.3)

- Es una **utilidad headless** (plugin de ProseMirror), no un componente de UI. Se consume desde una `Extension` propia (`this.proseMirrorPlugins = [Suggestion({...})]`).
- API clave: `char: '/'` (trigger), `items({ editor, query, signal })` (con `AbortSignal` + `debounce` + `initialItems` + `minQueryLength` para async), `command({ editor, range, props })` al seleccionar, y render del popup vía `props.mount/destroy` con helpers de Floating UI (`props.floatingUi.placement`, `offset`, `flip`, `container`). Docs: <https://www.tiptap.dev/docs/editor/api/utilities/suggestion>
- Ejemplo oficial de referencia: la extensión Mention (mismo patrón). Dismiss con Escape ya gestionado (`shouldResetDismissed`).
- **A construir**: la UI del popup (lista filtrada, teclado, estilos) — el plugin detecta trigger/query/posición pero no renderiza menú. Coste: bajo-medio; perfecto para combinar con `cmdk` (ya en deps).

### 2. BubbleMenu / FloatingMenu — `@tiptap/react/menus` (3.31.3)

- Componentes React oficiales: `import { BubbleMenu } from '@tiptap/react/menus'` (no hace falta añadir la extensión al editor). API: `shouldShow` prop, `options` con middleware de Floating UI, `updateDelay`, `pluginKey` para múltiples menús. Docs: <https://www.tiptap.dev/docs/editor/extensions/functionality/bubble-menu>
- `FloatingMenu` (mismo paquete/ruta, basado en `@tiptap/extension-floating-menu`) aparece al inicio de un bloque vacío — es el punto de anclaje Notion-style para botones "+" / menú de bloque.
- Pros: posicionamiento Floating UI resuelto, mounting automático. Cons: un solo ancla (selección) por defecto; todo el markup/estilo lo pones tú; para menús por-bloque es mejor DragHandle (ver 3).
- **A construir**: contenido y estilos de ambos menús.

### 3. Drag handle / node range — todas oficiales en v3 (3.31.3)

- `@tiptap/extension-drag-handle`: handle draggable que reordena bloques (drag & drop nativo). Settings: `render` (elemento del handle, posicionado con `@floating-ui/dom`), `computePositionConfig`, `onNodeChange({node, editor, pos})` (hover-highlight), `onElementDragStart/End`, `nested` (handles en bloques anidados), `locked`. Peer-deps: core, pm, **extension-node-range**, (opcional collaboration). Docs: <https://www.tiptap.dev/docs/editor/extensions/functionality/drag-handle>
- `@tiptap/extension-drag-handle-react`: wrapper React (`<DragHandle>` con children = contenido del handle, mismas props). Docs: <https://www.tiptap.dev/docs/editor/extensions/functionality/drag-handle-react>
- `@tiptap/extension-node-range`: `NodeRangeSelection` — selección alineada a bloques (Shift/Mod+drag sobre varios bloques), decoraciones incluidas (`getNodeRangeDecorations`, `getSelectionRanges`). Es lo que da la selección múltiple de bloques estilo Notion.
- **Qué dan exactamente**: handle visual + drag para reordenar (multi-bloque con node-range) + selección por bloques. **Qué falta**: el botón "+" y el menú de acciones por bloque (turn into, duplicate, delete) — el handle solo es un elemento draggable; el menú lo renderizas tú (children de `<DragHandle>` o FloatingMenu). Recomendable `@tiptap/extension-unique-id` (3.31.3) para IDs estables de bloque. Coste: medio (menú propio + wiring).

### 4. Tabla — `@tiptap/extension-table` (3.31.3)

- **Solo comandos, cero UI**: `insertTable({rows, cols, withHeaderRow})`, `addColumnBefore/After`, `addRowBefore/After`, `deleteColumn/Row/Table`, `mergeCells`/`splitCell`/`mergeOrSplit`, `toggleHeaderColumn/Row/Cell`, `setCellAttribute`, `goToNext/PreviousCell`, `fixTables`. Docs: <https://www.tiptap.dev/docs/editor/extensions/nodes/table>
- **Resize**: sí existe pero off por defecto — `resizable: true` añade handles de columna (`handleWidth: 5`, `cellMinWidth: 25`, `lastColumnResizable: true`, node view `TableView` + `renderWrapper`). No hay resize de filas.
- **Menú de tabla / botones add row-col: NO incluidos** — toca construirlos a mano (toolbar flotante sobre la tabla que llame a los comandos; detectar `Table`/`TableCell` activo). `TableKit` instala todo el conjunto. Coste: medio (UI sobre comandos ya existentes).

### 5. Color de texto y highlight

- **Color: mark oficial, no hace falta custom**. `@tiptap/extension-color` (3.31.3, re-export de `@tiptap/extension-text-style`; requiere `TextStyle`; viene en `TextStyleKit`). Aplica `style="color: ..."` en `<span>`. Comandos: `setColor()`, `unsetColor()`. Docs: <https://www.tiptap.dev/docs/editor/extensions/functionality/color>
- **Highlight: oficial con multicolor**. `@tiptap/extension-highlight` (3.31.3): opción `multicolor: true` + `toggleHighlight({ color })` / `setHighlight` / `unsetHighlight`; renderiza `<mark>`. Shortcut Cmd+Shift+H incluido. Docs: <https://www.tiptap.dev/docs/editor/extensions/marks/highlight>
- **A construir**: solo el picker/swatches de color (pop-over con BubbleMenu o en el bubble menu de selección).

### Resumen de brechas (lo que se construye a mano)

1. Popup del slash menu (Suggestion da toda la lógica de detección/posición).
2. Contenido/estilo de BubbleMenu + botón "+"/menú por bloque junto al DragHandle.
3. Toolbar de tabla con botones add/delete row-col + activar `resizable`.
4. Color picker.
5. Instalar: `@tiptap/suggestion`, `@tiptap/extension-drag-handle`, `@tiptap/extension-drag-handle-react`, `@tiptap/extension-node-range`, `@tiptap/extension-unique-id`, `@tiptap/extension-text-style`, `@tiptap/extension-color`, `@tiptap/extension-highlight` (y subir @tiptap/react/starter-kit a ^3.31.3 para alinear).
