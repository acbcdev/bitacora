# Spec — Editor Notion-UX

Contrato consolidado del grill de los tickets 02–05 + persistencia (06). Decisiones fecha
2026-09-26 (grill `/grill-with-docs`). Los fundamentos de cada decisión viven en los issues
02–05 y en ADR 0018 / 0019.

Objetivo: la nota se edita como en Notion — slash menu, bubble de formato, tablas con +
y handles, bloques con drag & drop — sin romper `ui-principles.md` (keyboard-first, chrome
mínimo) ni la persistencia existente (JSON como fuente de verdad, ADR 0018).

Criterio transversal de todo el lote: **integración fina**. Ninguna pieza nueva puede:

- robar el foco a la selección del editor (todo botón de overlay usa `mousedown → preventDefault`),
- introducir lag percibido en tipeo (los plugins corren en ProseMirror, la UI es portal/overlay),
- pisar shortcuts de la app (la partición de teclado es ADR 0017/0019 — verificar cada tecla
  contra `ui-principles.md` antes de asignar).

---

## Historias

### 1. Alinear Tiptap e instalar extensiones

`pnpm add` y subir a la última común **3.31.3**: `@tiptap/react`, `@tiptap/starter-kit`
(hoy ^3.28.0) + nuevas: `@tiptap/suggestion`, `@tiptap/extension-drag-handle`,
`@tiptap/extension-drag-handle-react`, `@tiptap/extension-node-range`,
`@tiptap/extension-unique-id`, `@tiptap/extension-text-style`, `@tiptap/extension-color`,
`@tiptap/extension-highlight`.

- **AC:** `pnpm build` y suite verde con la versión alineada; ninguna extensión duplicada
  (Color/TextStyle vienen en `TextStyleKit` si aplica).

### 2. Slash menu (ticket 02)

Extensión propia con `Suggestion` de `@tiptap/suggestion` + popup `cmdk` en portal
(posicionado con `props.floatingUi`: `bottom-start`, `offset 4`, `flip`).

- **Ítems (10):** Heading 1/2/3 · Lista con viñetas · Lista numerada · To-do · Cita ·
  Código · Divisor · Tabla · Imagen (file picker → `store.uploadNoteImage`, mismo path del
  paste de imagen). Headings 4–6 y "párrafo" fuera.
- **Trigger:** `/` al inicio de bloque o precedido de espacio. Query = texto hasta espacio o
  fin de línea; espacio cierra (o confirma si match único). Sin match = "no results";
  `Esc` restaura el `/` como texto literal.
- **On-select:** transformaciones (heading/listas/cita/código) convierten el bloque entero
  del cursor; inserciones (tabla/imagen/divisor) parten el párrafo en el cursor.
- **Tabla:** `insertTable({ rows: 2, cols: 2 })`, sin header row (el header se togglea desde
  la toolbar de tablas, historia 5).
- **Filtrado:** excluyente (escribir `h1` matchea "Heading 1"), case-insensitive.
- **AC:** tests del contrato de trigger (inicio/tras espacio/no mid-palabra), on-select
  transformación vs inserción, y render del popup con query filtrado. En modo Repaso funciona
  igual (no hay modo lectura — historia 7).

### 3. Teclado del editor (ADR 0019)

- `mod+B` **queda para el sidebar** (shadcn) — el keymap del editor remueve `Mod-b`.
- **Bold = `mod+Alt+B`** (`Bold.extend`); `mod+Shift+B` reservado (segundo sidebar).
- Clear formatting = **`mod+\`** → `unsetAllMarks` (incluye color y highlight).
- Resto de defaults de Tiptap quedan: italic `mod+I`, strike `mod+Shift+X`, code `mod+E`,
  highlight `mod+Shift+H`. Color **sin atajo**.
- **AC:** test de keymap: `mod+b` no togglea bold (cae al listener global del sidebar),
  `mod+alt+b` sí; `mod+\` limpia todas las marks incluidos color/highlight.

### 4. Bubble menu de formato (ticket 03)

`BubbleMenu` de `@tiptap/react/menus`. Aparece con selección no vacía; se oculta en
selección vacía y fuera del editor.

- **Fila única (7), `ToggleGroup` de shadcn**, `mousedown → preventDefault` en cada toggle:
  **B** · _I_ · ~~S~~ · `code` · **A** · **H** · ✕.
- Sin weight custom, sin turn-into (eso vive en slash menu y menú de bloque).
- **A / H:** popover (Radix/shadcn) con 8 fichas fijas (gris, marrón, naranja, amarillo,
  verde, azul, violeta, rojo) + "Quitar". Ficha aplicada → cierra; ficha ya activa = quitar.
  El icono del botón pinta el color activo (mini-preview). Color = mark oficial
  (`Color`/TextStyle), highlight = `Highlight` multicolor oficial.
- **✕** = `unsetAllMarks`.
- Estado activo de cada toggle vía `editor.isActive`.
- **AC:** test de isActive por control; test de paleta (8 fixed, ficha activa quita); el
  bubble no aparece en el editor de flashcard (no existe — historia 7) ni en Repaso colapsado.

### 5. Tablas: base + UI (ticket 04)

- `Table.configure({ resizable: true })` — sin migración (attr `colwidth` default null,
  ticket 06). Sin resize de filas (no existe en la extensión).
- **Dos `+` por hover** (overlay absoluto sobre el host, patrón `Outline`): hover de fila →
  `+` a la derecha del borde (`addColumnAfter`); hover de columna → `+` bajo el borde
  (`addRowAfter`). `Tab` en última celda crea fila (default ProseMirror, queda).
- **Handles con `DropdownMenu`:** `⋮⋮` (fila hovered, borde izquierdo) y `▾` (columna
  hovered, borde superior). Menú de fila: insertar arriba/abajo, duplicar, eliminar. Menú de
  columna: insertar izquierda/derecha, duplicar, eliminar, toggle header
  (`toggleHeaderColumn` / `toggleHeaderRow` en los menús, no botones sueltos).
- **Duplicar = build propio** (clone del nodo vía JSON + insert después; columna duplicada
  pierde header). **Alineación fuera** (el round-trip ya pierde `align`, ticket 06).
- **AC:** tests de comandos vía menú (insertar/duplicar/eliminar fila y columna, toggle
  header); overlay solo con `editable` (siempre, ver 7) y sin overlay en selection/scroll.

### 6. Bloques: drag handle + menú (ticket 05)

`DragHandle` de `@tiptap/extension-drag-handle-react` + `node-range` + `unique-id`.

- **Layout:** `+ ⋮⋮` side-by-side en el margen izquierdo del bloque hovered — todos los
  niveles (`nested: true`: ítems de lista incluidos).
- **`+`:** inserta párrafo vacío debajo del bloque y enfoca. Sin menú propio (el `/` ya
  está a un tipeo de distancia).
- **`⋮⋮` click** abre `DropdownMenu`: **Convertir a ▸** (Párrafo, H1/H2/H3, Lista, To-do,
  Cita, Código — sin tabla/imagen/divisor) · **Duplicar** (copia debajo) · **Eliminar**
  (directo, sin confirmación — un bloque se deshace con `mod+Z`).
- **Drag:** línea guía de 2px en el punto de drop (overlay propio). `Shift+click` extiende
  el rango; drag mueve el rango entero.
- **Reescritura v2 del drag (grill 2026-09-27):** el click en `⋮⋮` dejaba una NodeRangeSelection
  pintada como selección de texto azul ANTES de decidirse click vs drag — el drag nativo arrancaba
  en conflicto con esa selección activa (síntoma del usuario: "draggea como si seleccionara texto").
  Contrato nuevo:
  - **Dos selecciones separadas, como Notion:** click en `⋮⋮` = SOLO menú, no toca la selección
    del editor. Drag = agarrar el bloque. La selección de bloque solo existe con Shift+click.
  - **Selección de bloque visual ≠ selección de texto:** estilar las decoraciones que la
    extensión ya agrega (`ProseMirror-selectednoderange` / `ProseMirror-noderangeselection`)
    como halo gris redondeado a todo el ancho del bloque (mockup del usuario), sin azul de texto.
  - **Ghost del plugin solo:** muere el `dragPaint` global (estilos inline a mano con bug de
    limpieza). El ghost nativo hereda estilos leyendo el DOM.
  - La guía de drop estilo Notion (línea + dot + highlight) queda custom — decisión del usuario:
    "la nativa no, quiero la de bloques porque me da mejor customización y UX".
  - El motor sigue siendo el plugin oficial; lo reescrito de 0 es la capa de interacción UI encima
    (mousedown/selección/guía/pintado). Excepción a la regla transversal de
    `mousedown → preventDefault`: el ⋮⋮ no puede cancelarlo — iniciar el drag nativo es una
    acción default del mousedown, y cancelarlo lo mata (los demás botones del overlay siguen
    con preventDefault).
- **Visibilidad del asa (v2, grill 2026-09-27):** hoy el plugin la esconde apenas el puntero sale
  del contenteditable y solo la revive con mousemove sobre el texto — hay un hack de mousemove
  sintético para compensar. Contrato:
  - El asa aparece si el cursor está sobre el bloque **o sobre el gutter a su altura**
    (mapeo por Y: el bloque cuyo rect vertical contiene el cursor).
  - «Toda la fila» queda fuera: alineado con chrome mínimo, activa por bloque + gutter.
  - Muere el hack de `mousemove` sintético: la detección de zona (bloque + gutter) es propia
    de la capa UI, sin depender del ciclo mouseleave/mousemove del plugin.
- **Skip:** auto-scroll en drag (notas cortas), `FloatingMenu` (tercera puerta redundante,
  descartado en grill).
- **AC:** test de menú (convertir/duplicar/eliminar); drag test básico (reordenar dos
  párrafos); línea guía aparece durante drag; multi-bloque por node-range.

### 7. Un solo modo: editor siempre editable (decisión del grill)

No hay modo lectura vía editor. El dialog de Repaso de notas **ya edita con autosave**
(`note-dialog.tsx`). Resto:

- **Borrar la prop `editable` del `Editor`** y sus effects (sync `setEditable` + refresco en
  modo lectura).
- **Flashcard expandida: sin editor** — la respuesta se renderiza como texto simple
  (párrafos extraídos del doc; si hay tabla/imagen sale como texto). Cuando esa pantalla se
  construya, live el detalle; nunca con el editor.
- **AC:** no queda ningún `editable={false}` en el repo; suite de `editor.tsx` sin el ramal
  de modo lectura; `flashcard-card` muestra la respuesta como texto.

### 8. Persistencia: sin cambios (ADR 0018)

JSON de ProseMirror sigue siendo la fuente de verdad; el serializador markdown propio queda
como está. El export/copy `.md` pierde color/highlight/align si sale y entra — aceptado.
Round-trip tests existentes intactos.

- **AC:** ningún cambio en `tiptap-markdown.ts`; los tests del round-trip pasan sin tocarlos.
  Se reabre (opción HTML embebido o `@tiptap/markdown` oficial) solo si el export se vuelve
  camino real de migración/backup.

---

## Orden sugerido

1 (deps) → 3 (teclado, chico y desbloquea probar) → 2 (slash) → 4 (bubble) → 5 (tablas) →
6 (bloques) → 7 (modo único — puede ir antes, es mecánico) → 8 (no-op, solo verificar).
Historias 2/4/5/6 son independientes entre sí una vez 1 está.
