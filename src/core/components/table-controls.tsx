import { useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent, RefObject } from "react"
import { Node } from "@tiptap/pm/model"
import {
  TableMap,
  columnIsHeader,
  moveTableColumn,
  moveTableRow,
  rowIsHeader,
} from "@tiptap/pm/tables"
import type { EditorView } from "@tiptap/pm/view"
import type { Editor } from "@tiptap/react"
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CopyIcon,
  EllipsisIcon,
  GripHorizontalIcon,
  GripVerticalIcon,
  HeadingIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { preventFocus } from "@/core/components/prevent-focus"

// Controles de tabla "Fantasma" (prototipo .scratch/editor-tables, ganó sobre Gutter y Bordes).
// Overlay absoluto sobre el host, por hover de celda:
// - ⋯ en la esquina de la celda: clic → menú de fila + columna; arrastrar → swap con otra celda.
// - Grip arriba de la columna / a la izquierda de la fila: arrastrar → reordenar.
// - "+ Nueva fila" debajo (solo en la última fila) y + de columna a la derecha (solo en la
//   última columna), separados de la tabla: nunca tapan contenido.
// El resize de columnas es el nativo de prosemirror-tables (resizable: true en editor.tsx);
// acá solo el estilo del handle, en index.css.

type Rect = { top: number; left: number; width: number; height: number }

type Hover = {
  cell: HTMLTableCellElement
  r: number
  c: number
  // Relativos al host.
  cellBox: Rect
  row: Rect
  col: Rect
  table: Rect
  headerRow: boolean
  headerCol: boolean
}

// Arrastre en curso. Celda: fuente atenuada + celda destino marcada. Fila/columna: reorden en
// vivo — las vecinas se corren para abrir el hueco donde va a caer (se ve el resultado antes
// de soltar). En los dos, un preview que sigue al cursor.
type Drag = {
  kind: "row" | "col" | "cell"
  box: Rect
  preview: HTMLElement
  dx: number
  dy: number
  // Fila/columna: clon opaco de la tabla encima de la real donde las vecinas se corren en vivo.
  stage: HTMLElement | null
  target: Rect | null
}

const union = (rects: Rect[]): Rect => ({
  top: Math.min(...rects.map((r) => r.top)),
  left: Math.min(...rects.map((r) => r.left)),
  width: Math.max(...rects.map((r) => r.left + r.width)) - Math.min(...rects.map((r) => r.left)),
  height: Math.max(...rects.map((r) => r.top + r.height)) - Math.min(...rects.map((r) => r.top)),
})

const relTo = (host: HTMLElement) => {
  const h = host.getBoundingClientRect()
  return (el: Element): Rect => {
    const b = el.getBoundingClientRect()
    return { top: b.top - h.top, left: b.left - h.left, width: b.width, height: b.height }
  }
}

// ── Localizar la celda en el doc ───────────────────────────────────────────────

function locate(view: EditorView, cell: HTMLElement) {
  const $pos = view.state.doc.resolve(view.posAtDOM(cell, 0))
  let cellDepth = 0
  let rowDepth = 0
  let tableDepth = 0
  // Primer match = el más profundo: el del inner table (paste de Notion con tabla anidada).
  for (let d = $pos.depth; d > 0; d--) {
    const role = $pos.node(d).type.spec.tableRole
    if (!cellDepth && (role === "cell" || role === "header_cell")) cellDepth = d
    if (!rowDepth && role === "row") rowDepth = d
    if (!tableDepth && role === "table") tableDepth = d
  }
  return { $pos, cellDepth, rowDepth, tableDepth }
}

function computeHover(view: EditorView, host: HTMLElement, cell: HTMLTableCellElement): Hover {
  const rel = relTo(host)
  const row = cell.parentElement as HTMLTableRowElement
  const table = cell.closest("table")!
  const c = [...row.cells].indexOf(cell)
  // ponytail: índices DOM naivos — celdas con colspan/rowspan desalinean la columna; el paste
  // Markdown no las crea. Si entra merge del paste de Notion, migrar a índices de TableMap.
  const colCells = [...table.rows].map((r) => r.cells[c]).filter(Boolean)
  // Header por tipo de nodo, no por <th>: una columna de encabezado también mete <th> en el body.
  const { $pos, tableDepth } = locate(view, cell)
  const node = $pos.node(tableDepth)
  const map = TableMap.get(node)
  return {
    cell,
    r: row.rowIndex,
    c,
    cellBox: rel(cell),
    row: union([...row.cells].map(rel)),
    col: union(colCells.map(rel)),
    table: rel(table),
    headerRow: rowIsHeader(map, node, 0),
    headerCol: columnIsHeader(map, node, 0),
  }
}

const key = (h: Hover) =>
  `${h.cell.textContent}|${JSON.stringify(h.cellBox)}|${JSON.stringify(h.table)}`

// Duplicar fila: clone del nodo vía JSON + insert después (comando propio de la spec).
function duplicateRow(view: EditorView, cell: HTMLElement) {
  const { $pos, rowDepth } = locate(view, cell)
  const clone = Node.fromJSON(view.state.schema, $pos.node(rowDepth).toJSON())
  view.dispatch(view.state.tr.insert($pos.after(rowDepth), clone))
}

// Duplicar columna: rearma la tabla con la celda copiada en cada fila. La copia pierde el
// header (sale como celda común) — decisión de la spec. Si alguna fila no llega a ese
// índice (colspan/rowspan de un paste), no duplica — fuera de alcance (ver computeHover).
function duplicateColumn(view: EditorView, cell: HTMLElement) {
  const { $pos, rowDepth, tableDepth } = locate(view, cell)
  // index(rowDepth) = índice de la celda dentro de la fila (el hijo del nodo en rowDepth).
  const colIndex = $pos.index(rowDepth)
  const rows: Array<{ content?: Array<Record<string, unknown>> }> = []
  let even = true
  $pos.node(tableDepth).forEach((rowNode) => {
    const rowJSON = rowNode.toJSON() as { content?: Array<Record<string, unknown>> }
    if (!rowJSON.content?.[colIndex]) even = false
    rows.push(rowJSON)
  })
  if (!even) return
  for (const rowJSON of rows) {
    const cells = rowJSON.content!
    cells.splice(colIndex + 1, 0, { ...cells[colIndex], type: "tableCell" })
  }
  const clone = Node.fromJSON(view.state.schema, { type: "table", content: rows })
  view.dispatch(view.state.tr.replaceWith($pos.before(tableDepth), $pos.after(tableDepth), clone))
}

// Swap de contenido entre dos celdas (cada una conserva tipo y attrs: header y colwidth se
// quedan en su lugar). Una transacción → un solo undo. Se reemplaza primero la de más
// adelante: así la posición de la otra no se mueve.
export function swapCells(view: EditorView, a: HTMLElement, b: HTMLElement) {
  const at = (el: HTMLElement) => {
    const { $pos, cellDepth } = locate(view, el)
    return { pos: $pos.before(cellDepth), node: $pos.node(cellDepth) }
  }
  const [first, second] = [at(a), at(b)].toSorted((x, y) => x.pos - y.pos)
  if (first.pos === second.pos) return
  const inner = (x: typeof first) => [x.pos + 1, x.pos + x.node.nodeSize - 1] as const
  const tr = view.state.tr
  tr.replaceWith(...inner(second), first.node.content)
  tr.replaceWith(...inner(first), second.node.content)
  view.dispatch(tr)
}

// Mover la fila/columna `from` al borde `boundary` (0..n, el borde ANTES del índice).
export function moveAt(
  editor: Editor,
  cell: HTMLElement,
  kind: "row" | "col",
  from: number,
  boundary: number,
) {
  if (boundary === from || boundary === from + 1) return
  const view = editor.view
  const move = kind === "col" ? moveTableColumn : moveTableRow
  // prosemirror-tables resuelve los índices contra la SELECCIÓN (getSelectionRangeIn*), no
  // contra `pos`: con el caret fuera de la tabla el comando no hace nada. Selección primero
  // (una tr solo de selección no suma paso de undo).
  editor.chain().setTextSelection(view.posAtDOM(cell, 0)).run()
  // `to` del comando = índice final; el borde de destino está corrido en uno si va después.
  const to = boundary > from ? boundary - 1 : boundary
  move({ from, to, select: false, pos: view.posAtDOM(cell, 0) })(view.state, view.dispatch)
}

// Preview de arrastre: clon de la tabla entera recortado a `box` (fila, columna o celda) —
// mismo layout gratis. Envuelto en .tiptap-host .ProseMirror: los estilos de td/th/code están
// scopeados ahí (index.css); sin los wrappers el clon sale sin bordes, padding ni fondo.
function tablePreview(table: HTMLTableElement, t: Rect, box: Rect) {
  const clone = table.cloneNode(true) as HTMLElement
  Object.assign(clone.style, {
    position: "absolute",
    margin: "0",
    width: `${t.width}px`,
    left: `${t.left - box.left}px`,
    top: `${t.top - box.top}px`,
  })
  // .tableWrapper también: el text-sm de la tabla cuelga de `.tableWrapper table`.
  const wrapper = document.createElement("div")
  wrapper.className = "tableWrapper"
  wrapper.append(clone)
  const pm = document.createElement("div")
  pm.className = "ProseMirror"
  pm.append(wrapper)
  const scope = document.createElement("div")
  scope.className = "tiptap-host"
  scope.append(pm)
  return scope
}

// ── UI ──────────────────────────────────────────────────────────────────────────

// Banda alrededor de la tabla donde el hover sobrevive (grips arriba/izquierda, fantasmas
// abajo/derecha): cruzar de la celda al control no puede matar el overlay a mitad de camino.
const BAND = { top: 26, left: 28, right: 48, bottom: 48 }
const GAP = 8 // aire entre la tabla y los fantasmas
const GHOST = 32

const ctl =
  "pointer-events-auto absolute grid place-items-center rounded-full bg-hero text-fg-secondary transition-colors hover:bg-muted hover:text-foreground"
const ghost =
  "pointer-events-auto absolute flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors animate-in fade-in duration-150 hover:bg-card hover:text-foreground"
const itemIcon = "size-3.5 text-fg-secondary"

const px = (r: Rect) => ({ left: r.left, top: r.top, width: r.width, height: r.height })

export function TableHoverControls({
  editor,
  host,
}: {
  editor: Editor
  host: RefObject<HTMLDivElement | null>
}) {
  const [hover, setHover] = useState<Hover | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  // Último hover vivo en ref: el cierre de onMove lee el actual sin re-suscribirse.
  const hoverRef = useRef<Hover | null>(null)
  // Arrastre o menú en curso: el hover queda congelado.
  const busy = useRef(false)
  // Dedup de hover: la misma celda/rects no re-renderiza.
  const lastKey = useRef("")

  // Menú abierto = hover congelado (si no, un mousemove desmonta el trigger y cierra el menú).
  const openMenu = (open: boolean) => {
    setMenuOpen(open)
    busy.current = open
  }

  const clear = () => {
    lastKey.current = ""
    hoverRef.current = null
    setHover(null)
    openMenu(false)
  }

  useEffect(() => {
    const el = host.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      if (busy.current) return
      const target = e.target as HTMLElement | null
      // Cruzando hacia nuestros botones: el hover vigente sigue siendo el correcto.
      if (target?.closest?.("[data-table-ctrl]")) return
      const cell = target?.closest?.("td, th") as HTMLTableCellElement | null
      if (cell && el.contains(cell)) {
        const h = computeHover(editor.view, el, cell)
        const k = key(h)
        if (k !== lastKey.current) {
          lastKey.current = k
          hoverRef.current = h
          setHover(h)
        }
        return
      }
      // Con border-collapse los pixeles entre celdas vecinas caen en el <table>.
      if (target && el.contains(target) && target.closest("table")) return
      const cur = hoverRef.current
      if (cur && cur.cell.isConnected) {
        const hBox = el.getBoundingClientRect()
        const x = e.clientX - hBox.left
        const y = e.clientY - hBox.top
        const t = cur.table
        const inX = x >= t.left - BAND.left && x <= t.left + t.width + BAND.right
        const inY = y >= t.top - BAND.top && y <= t.top + t.height + BAND.bottom
        if (inX && inY) return
      }
      if (hoverRef.current) clear()
    }
    // Scroll en descendientes (el overflow-x de la tabla): los rects quedan viejos, limpiar.
    const onScroll = () => !busy.current && clear()
    // mousemove en document, no en el host: la tabla es w-full (= ancho del host), así que el
    // grip de fila y el + de columna quedan FUERA del host — un mouseleave del host mataba el
    // overlay antes de llegar. La salida la decide la banda.
    document.addEventListener("mousemove", onMove)
    el.addEventListener("scroll", onScroll, true)
    return () => {
      document.removeEventListener("mousemove", onMove)
      el.removeEventListener("scroll", onScroll, true)
    }
  }, [editor, host])

  // ProseMirror re-renderiza el DOM de la tabla (move, undo, autosave): la celda del hover
  // queda descolgada y closest("table") da null. El próximo mousemove arma el hover nuevo.
  if (!hover || !host.current || !hover.cell.isConnected) return null

  const { cell, r, c } = hover
  const hostEl = host.current
  const table = cell.closest("table")!
  const view = editor.view

  const chainAt = (target: HTMLElement) =>
    editor.chain().focus().setTextSelection(view.posAtDOM(target, 0))

  const run = (fn: () => void) => () => {
    // Un undo/edición externa puede borrar la tabla sin mover el mouse: nada que hacer.
    if (cell.isConnected) fn()
    clear()
  }

  const isLastRow = r === table.rows.length - 1
  const isLastCol = c === (cell.parentElement as HTMLTableRowElement).cells.length - 1
  const lastOfRow = () => {
    const cells = (cell.parentElement as HTMLTableRowElement).cells
    return cells[cells.length - 1]
  }
  const lastOfColumn = () => table.rows[table.rows.length - 1].cells[c] ?? cell

  // ── Gestos ──

  // Arrastre genérico por pointer en window: move actualiza el estado, up aplica y limpia.
  const track = (onMove: (e: PointerEvent) => void, onUp: () => void) => {
    busy.current = true
    document.body.style.cursor = "grabbing"
    const up = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", up)
      document.body.style.cursor = ""
      busy.current = false
      setDrag(null)
      if (cell.isConnected) onUp()
      clear()
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", up)
  }

  // Reordenar fila/columna: el preview es un clon de la tabla entera recortado a la
  // fila/columna (mismo layout gratis). `to` = borde de destino (0..n).
  const startReorder = (kind: "row" | "col", e: ReactPointerEvent) => {
    e.preventDefault()
    const rel = relTo(hostEl)
    const t = hover.table
    const col = kind === "col"
    const bounds = col
      ? [...[...table.rows[0].cells].map((x) => rel(x).left), t.left + t.width]
      : [...[...table.rows].map((x) => rel(x).top), t.top + t.height]
    const from = col ? c : r
    const min = (col ? hover.headerCol : hover.headerRow) ? 1 : 0
    const box = col ? { ...hover.col } : { ...hover.row }
    const preview = tablePreview(table, t, box)
    // Escenario: clon de la tabla entera en su mismo lugar (tapa la real). El slot arrastrado
    // queda vacío; las filas/columnas entre origen y destino se corren su tamaño.
    const stage = tablePreview(table, t, t)
    const rows = [...stage.querySelector("table")!.rows]
    const slot = (i: number): HTMLElement[] => (col ? rows.map((x) => x.cells[i]) : [rows[i]])
    const count = bounds.length - 1
    const size = col ? box.width : box.height
    const ease = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? ""
      : "transform 150ms var(--ease-out)"
    for (let i = 0; i < count; i++) for (const el of slot(i)) el.style.transition = ease
    for (const el of slot(from)) el.style.visibility = "hidden"
    // td son transparentes: al correrse dejaban ver los bordes colapsados de la grilla de abajo.
    // Opacas (th ya trae bg-muted), el único hueco que queda es el destino (bg-card del escenario).
    for (const td of stage.querySelectorAll<HTMLElement>("td"))
      td.style.backgroundColor = "var(--background)"
    const start = col ? e.clientX : e.clientY
    const hBox = hostEl.getBoundingClientRect()
    let to = from
    setDrag({ kind, box, preview, dx: 0, dy: 0, stage, target: null })
    track(
      (m) => {
        const cur = col ? m.clientX : m.clientY
        const pos = cur - (col ? hBox.left : hBox.top)
        to = bounds.reduce(
          (best, b, i) => (i >= min && Math.abs(b - pos) < Math.abs(bounds[best] - pos) ? i : best),
          min,
        )
        const final = to > from ? to - 1 : to
        for (let i = 0; i < count; i++) {
          const shift = i > from && i <= final ? -size : i < from && i >= final ? size : 0
          const tf = shift ? (col ? `translateX(${shift}px)` : `translateY(${shift}px)`) : ""
          if (i !== from) for (const el of slot(i)) el.style.transform = tf
        }
        // El preview sigue al cursor sobre su eje, sin salirse de la tabla.
        const d = col
          ? Math.max(
              t.left - box.left,
              Math.min(t.left + t.width - box.left - box.width, cur - start),
            )
          : Math.max(
              t.top - box.top,
              Math.min(t.top + t.height - box.top - box.height, cur - start),
            )
        // Hueco de destino, marcado igual que la celda destino del drag de celda.
        const at = final > from ? bounds[final + 1] - size : bounds[final]
        const target = col
          ? { left: at, top: t.top, width: size, height: t.height }
          : { left: t.left, top: at, width: t.width, height: size }
        setDrag((s) => s && { ...s, dx: col ? d : 0, dy: col ? 0 : d, target })
      },
      () => moveAt(editor, cell, kind, from, to),
    )
  }

  // ⋯: clic → menú; arrastrar >4px → mover la celda (contrato del block handle de Notion).
  // preventDefault en pointerdown: Radix abre el trigger en pointerdown y lo saltea si el
  // evento ya viene defaultPrevented — el open lo controlamos acá. Enter/Space siguen siendo
  // de Radix (onOpenChange).
  const onMorePointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    const x0 = e.clientX
    const y0 = e.clientY
    const off = () => {
      window.removeEventListener("pointermove", mv)
      window.removeEventListener("pointerup", up)
    }
    const mv = (m: PointerEvent) => {
      if (Math.hypot(m.clientX - x0, m.clientY - y0) < 4) return
      off()
      startCellDrag(x0, y0, m)
    }
    const up = () => {
      off()
      openMenu(true)
    }
    window.addEventListener("pointermove", mv)
    window.addEventListener("pointerup", up)
  }

  const startCellDrag = (x0: number, y0: number, m0: PointerEvent) => {
    const rel = relTo(hostEl)
    const box = { ...hover.cellBox }
    const preview = tablePreview(table, hover.table, box)
    let target: HTMLElement | null = null
    const onMove = (m: PointerEvent) => {
      const el = document
        .elementFromPoint(m.clientX, m.clientY)
        ?.closest("td, th") as HTMLElement | null
      target = el && el !== cell && el.closest("table") === table ? el : null
      setDrag(
        (s) => s && { ...s, dx: m.clientX - x0, dy: m.clientY - y0, target: target && rel(target) },
      )
    }
    setDrag({ kind: "cell", box, preview, dx: 0, dy: 0, stage: null, target: null })
    track(onMove, () => target && swapCells(view, cell, target))
    onMove(m0)
  }

  const menu = (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Fila
      </DropdownMenuLabel>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).addRowBefore().run())}>
        <ArrowUpIcon className={itemIcon} /> Insertar arriba
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).addRowAfter().run())}>
        <ArrowDownIcon className={itemIcon} /> Insertar abajo
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => duplicateRow(view, cell))}>
        <CopyIcon className={itemIcon} /> Duplicar fila
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).deleteRow().run())}>
        <Trash2Icon className={itemIcon} /> Eliminar fila
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Columna
      </DropdownMenuLabel>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).addColumnBefore().run())}>
        <ArrowLeftIcon className={itemIcon} /> Insertar a la izquierda
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).addColumnAfter().run())}>
        <ArrowRightIcon className={itemIcon} /> Insertar a la derecha
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => duplicateColumn(view, cell))}>
        <CopyIcon className={itemIcon} /> Duplicar columna
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).deleteColumn().run())}>
        <Trash2Icon className={itemIcon} /> Eliminar columna
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={run(() => chainAt(cell).toggleHeaderRow().run())}>
        <HeadingIcon className={itemIcon} /> Fila de encabezado
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).toggleHeaderColumn().run())}>
        <HeadingIcon className={itemIcon} /> Columna de encabezado
      </DropdownMenuItem>
    </>
  )

  const t = hover.table

  return (
    // pointer-events-none en el manto: solo los botones capturan el mouse.
    <div className="absolute inset-0 z-20 pointer-events-none" data-testid="table-controls">
      {drag ? (
        <>
          {drag.stage ? (
            <div
              className="absolute bg-card"
              style={px(hover.table)}
              ref={(el) => {
                if (el && el.firstChild !== drag.stage) el.replaceChildren(drag.stage!)
              }}
            />
          ) : (
            <div className="absolute bg-background/75" style={px(drag.box)} />
          )}
          {drag.target && (
            <div
              className="absolute ring-2 ring-inset ring-foreground/35"
              style={px(drag.target)}
            />
          )}
          <div
            className="absolute overflow-hidden bg-hero text-sm shadow-xl ring-1 ring-border"
            style={{ ...px(drag.box), transform: `translate(${drag.dx}px, ${drag.dy}px)` }}
            ref={(el) => {
              if (el && el.firstChild !== drag.preview) el.replaceChildren(drag.preview)
            }}
          />
        </>
      ) : (
        <>
          {/* Grip de columna: arriba del borde superior, sin pisar el header. */}
          {!(hover.headerCol && c === 0) && (
            <button
              type="button"
              data-table-ctrl=""
              data-testid="table-col-grip"
              aria-label="Arrastrar columna"
              className={`${ctl} h-4 w-6 cursor-grab`}
              style={{ left: hover.col.left + hover.col.width / 2 - 12, top: t.top - 20 }}
              onMouseDown={preventFocus}
              onPointerDown={(e) => startReorder("col", e)}
            >
              <GripHorizontalIcon className="size-3.5" />
            </button>
          )}

          {/* Grip de fila: a la izquierda, centrado en la primera línea. La fila de
              encabezado queda fija arriba. */}
          {!(hover.headerRow && r === 0) && (
            <button
              type="button"
              data-table-ctrl=""
              data-testid="table-row-grip"
              aria-label="Arrastrar fila"
              className={`${ctl} h-5.5 w-4 cursor-grab`}
              style={{
                left: t.left - 22,
                top: hover.row.top + (Math.min(hover.row.height, 34) - 22) / 2,
              }}
              onMouseDown={preventFocus}
              onPointerDown={(e) => startReorder("row", e)}
            >
              <GripVerticalIcon className="size-3.5" />
            </button>
          )}

          <DropdownMenu open={menuOpen} onOpenChange={openMenu}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-table-ctrl=""
                data-testid="table-cell-menu"
                aria-label="Opciones de celda"
                className={`${ctl} size-6 cursor-grab`}
                style={{
                  left: hover.cellBox.left + hover.cellBox.width - 32,
                  top: hover.cellBox.top + (Math.min(hover.cellBox.height, 34) - 24) / 2,
                }}
                onMouseDown={preventFocus}
                onPointerDown={onMorePointerDown}
              >
                <EllipsisIcon className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              {menu}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Fantasmas: solo en la última fila / columna, separados de la tabla. */}
          {isLastRow && (
            <button
              type="button"
              data-table-ctrl=""
              data-testid="table-add-row"
              className={`${ghost} px-3.5`}
              style={{ left: t.left, top: t.top + t.height + GAP, width: t.width, height: GHOST }}
              onMouseDown={preventFocus}
              onClick={run(() => chainAt(lastOfColumn()).addRowAfter().run())}
            >
              <PlusIcon className="size-3.5" /> Nueva fila
            </button>
          )}
          {isLastCol && (
            <button
              type="button"
              data-table-ctrl=""
              data-testid="table-add-col"
              aria-label="Nueva columna"
              className={`${ghost} justify-center`}
              style={{ left: t.left + t.width + GAP, top: t.top, width: GHOST, height: t.height }}
              onMouseDown={preventFocus}
              onClick={run(() => chainAt(lastOfRow()).addColumnAfter().run())}
            >
              <PlusIcon className="size-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  )
}
