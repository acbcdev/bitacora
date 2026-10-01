import { useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import { Node } from "@tiptap/pm/model"
import type { EditorView } from "@tiptap/pm/view"
import type { Editor } from "@tiptap/react"
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  CopyIcon,
  GripVerticalIcon,
  HeadingIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { preventFocus } from "@/core/components/prevent-focus"

// Controles de tabla por hover (spec .scratch/editor-notion-ux, historia 5). Overlay absoluto
// sobre el host (mismo patrón que Outline): hover de fila → ⋮⋮ al borde izquierdo y + a la
// derecha (addColumnAfter, solo en la última columna); hover de columna → ▾ al borde superior
// y + debajo (addRowAfter, solo en la última fila). Los handles abren DropdownMenu (insertar /
// duplicar / eliminar / toggle header). Todo botón usa mousedown → preventDefault para no robar
// el foco de la selección del editor.

type Rect = { top: number; left: number; width: number; height: number }

type Hover = {
  cell: HTMLTableCellElement
  // Unión de las celdas de la fila / de la columna, relativas al host.
  row: Rect
  col: Rect
}

const union = (rects: Rect[]): Rect => ({
  top: Math.min(...rects.map((r) => r.top)),
  left: Math.min(...rects.map((r) => r.left)),
  width: Math.max(...rects.map((r) => r.left + r.width)) - Math.min(...rects.map((r) => r.left)),
  height: Math.max(...rects.map((r) => r.top + r.height)) - Math.min(...rects.map((r) => r.top)),
})

function computeHover(host: HTMLElement, cell: HTMLTableCellElement): Hover {
  const hostBox = host.getBoundingClientRect()
  const rel = (el: Element): Rect => {
    const b = el.getBoundingClientRect()
    return {
      top: b.top - hostBox.top,
      left: b.left - hostBox.left,
      width: b.width,
      height: b.height,
    }
  }
  const row = cell.parentElement as HTMLTableRowElement
  const table = cell.closest("table")!
  const colIndex = [...row.cells].indexOf(cell)
  // ponytail: índices DOM naivos — celdas con colspan/rowspan desalinean la columna; el paste
  // Markdown no las crea. Si entra merge del paste de Notion, migrar a índices de ProseMirror.
  const colCells = [...table.rows].map((r) => r.cells[colIndex]).filter(Boolean)
  return { cell, row: union([...row.cells].map(rel)), col: union(colCells.map(rel)) }
}

const key = (h: Hover) => `${h.cell.textContent}|${JSON.stringify(h.row)}|${JSON.stringify(h.col)}`

// ── Localizar la celda en el doc ───────────────────────────────────────────────

function locate(view: EditorView, cell: HTMLElement) {
  const $pos = view.state.doc.resolve(view.posAtDOM(cell, 0))
  let rowDepth = 0
  let tableDepth = 0
  // Primer match = el más profundo: el del inner table (paste de Notion con tabla anidada).
  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name
    if (!rowDepth && name === "tableRow") rowDepth = d
    if (!tableDepth && name === "table") tableDepth = d
  }
  return { $pos, rowDepth, tableDepth }
}

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

// ── UI ──────────────────────────────────────────────────────────────────────────

const BTN = 18
const ADD_W = 28

// Botón + en píldora: se estira a lo largo de toda la fila/columna (hit area grande).
const addCls =
  "pointer-events-auto absolute grid place-items-center rounded-[10px] border border-popover bg-popover text-fg-secondary shadow-sm hover:bg-muted hover:text-foreground"
const ctlCls =
  "pointer-events-auto absolute grid size-[18px] place-items-center rounded-[4px] border border-popover bg-popover text-fg-secondary shadow-sm hover:bg-muted hover:text-foreground"

const itemIcon = "size-3.5 text-fg-secondary"

export function TableHoverControls({
  editor,
  host,
}: {
  editor: Editor
  host: RefObject<HTMLDivElement | null>
}) {
  const [hover, setHover] = useState<Hover | null>(null)

  // Último hover vivo en ref: el cierre de onMove lee el actual sin re-suscribirse.
  const hoverRef = useRef<Hover | null>(null)

  // Dedup de hover: la misma celda/rects no re-renderiza. En ref para que run() pueda
  // resetearlo desde fuera del closure del effect.
  const lastKey = useRef("")
  useEffect(() => {
    const el = host.current
    if (!el) return
    const clear = () => {
      lastKey.current = ""
      hoverRef.current = null
      setHover(null)
    }
    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      // Cruzando hacia nuestros botones: el hover vigente sigue siendo el correcto.
      if (target?.closest?.("[data-table-ctrl]")) return
      const cell = target?.closest?.("td, th") as HTMLTableCellElement | null
      if (cell && el.contains(cell)) {
        const h = computeHover(el, cell)
        const k = key(h)
        if (k !== lastKey.current) {
          lastKey.current = k
          hoverRef.current = h
          setHover(h)
        }
        return
      }
      // Con border-collapse los pixeles entre celdas vecinas caen en el <table>: mantener
      // el hover (es el mismo lugar visual). Salir de la tabla sí limpia.
      if (target && el.contains(target) && target.closest("table")) return
      // Hueco de 4px entre la tabla y la píldora +: el mousemove cae en el host (ni celda
      // ni botón). Mantener el hover mientras el puntero siga en la zona de las píldoras
      // (borde + grosor de la píldora + margen): cruzar del cell al + no puede matarlo a
      // mitad de camino ni al pasar por encima de contenido vecino.
      const cur = hoverRef.current
      if (cur && cur.cell.isConnected) {
        const hBox = el.getBoundingClientRect()
        const tBox = cur.cell.closest("table")!.getBoundingClientRect()
        const x = e.clientX - hBox.left
        const y = e.clientY - hBox.top
        const inBandX = x >= tBox.left - hBox.left - 6 && x <= tBox.right - hBox.left + ADD_W + 8
        const inBandY = y >= tBox.top - hBox.top - 6 && y <= tBox.bottom - hBox.top + ADD_W + 8
        if (inBandX && inBandY) return
      }
      clear()
    }
    el.addEventListener("mousemove", onMove)
    el.addEventListener("mouseleave", clear)
    // Scroll en descendientes (el overflow-x de la tabla): los rects quedan viejos, limpiar.
    el.addEventListener("scroll", clear, true)
    return () => {
      el.removeEventListener("mousemove", onMove)
      el.removeEventListener("mouseleave", clear)
      el.removeEventListener("scroll", clear, true)
    }
  }, [editor, host])

  if (!hover) return null

  const chainAt = (target: HTMLElement) =>
    editor.chain().focus().setTextSelection(editor.view.posAtDOM(target, 0))

  const cell = hover.cell
  const run = (fn: () => void) => () => {
    // Un undo/edición externa puede borrar la tabla sin mover el mouse: el hover queda
    // pintado sobre un nodo descolgado — no hay nada que hacer con él.
    if (!cell.isConnected) {
      lastKey.current = ""
      setHover(null)
      return
    }
    try {
      fn()
    } finally {
      // Limpia el hover y el dedup SOLO si sigue siendo esta celda: el click dispara un
      // mousemove posterior y no hay que pisarlo.
      lastKey.current = ""
      hoverRef.current = null
      setHover((h) => (h?.cell === cell ? null : h))
    }
  }

  // Estilo Notion: el + de la fila agrega la columna AL FINAL de la tabla (se selecciona la
  // última celda de la fila hovered) y el + de la columna agrega la fila al pie. Solo aparecen
  // en el hover de la última fila / última columna, montados sobre esa fila/columna. Los menús,
  // en cambio, insertan pegado a la fila/columna hovered.
  const isLastRow =
    cell.parentElement ===
    cell.closest("table")!.tBodies[0].rows[cell.closest("table")!.tBodies[0].rows.length - 1]
  const isLastCol =
    (cell.parentElement as HTMLTableRowElement).cells[
      (cell.parentElement as HTMLTableRowElement).cells.length - 1
    ] === cell
  const lastOfRow = () =>
    (cell.parentElement as HTMLTableRowElement).cells[
      (cell.parentElement as HTMLTableRowElement).cells.length - 1
    ]
  const lastOfColumn = () => {
    const table = cell.closest("table")!
    const colIndex = [...(cell.parentElement as HTMLTableRowElement).cells].indexOf(cell)
    const lastRow = table.rows[table.rows.length - 1]
    return lastRow.cells[colIndex] ?? cell
  }

  const rowMenu = (
    <>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).addRowBefore().run())}>
        <ArrowUpIcon className={itemIcon} /> Insertar arriba
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).addRowAfter().run())}>
        <ArrowDownIcon className={itemIcon} /> Insertar abajo
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => duplicateRow(editor.view, cell))}>
        <CopyIcon className={itemIcon} /> Duplicar
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).toggleHeaderRow().run())}>
        <HeadingIcon className={itemIcon} /> Fila de encabezado
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={run(() => chainAt(cell).deleteRow().run())}>
        <Trash2Icon className={itemIcon} /> Eliminar
      </DropdownMenuItem>
    </>
  )

  const colMenu = (
    <>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).addColumnBefore().run())}>
        <ArrowLeftIcon className={itemIcon} /> Insertar a la izquierda
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).addColumnAfter().run())}>
        <ArrowRightIcon className={itemIcon} /> Insertar a la derecha
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => duplicateColumn(editor.view, cell))}>
        <CopyIcon className={itemIcon} /> Duplicar
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={run(() => chainAt(cell).toggleHeaderColumn().run())}>
        <HeadingIcon className={itemIcon} /> Columna de encabezado
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={run(() => chainAt(cell).deleteColumn().run())}>
        <Trash2Icon className={itemIcon} /> Eliminar
      </DropdownMenuItem>
    </>
  )

  return (
    // pointer-events-none en el manto: solo los botones capturan el mouse.
    <div className="absolute inset-0 z-20 pointer-events-none" data-testid="table-controls">
      {/* Handle de fila: MONTADO sobre el borde izquierdo de la fila hovered (mitad
          adentro/mitad afuera — no come margen externo de la nota). */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-table-ctrl=""
            data-testid="table-row-menu"
            aria-label="Menú de fila"
            className={ctlCls}
            style={{
              left: hover.row.left - BTN / 2,
              top: hover.row.top + hover.row.height / 2,
              transform: "translateY(-50%)",
            }}
            onMouseDown={preventFocus}
          >
            <GripVerticalIcon className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-40">
          {rowMenu}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* + de fila: a la derecha del borde (addColumnAfter) — solo en la última columna,
          centrado en toda la altura de la columna. */}
      {isLastCol && (
        <button
          type="button"
          data-table-ctrl=""
          data-testid="table-row-add"
          aria-label="Añadir columna"
          className={addCls}
          style={{
            left: hover.col.left + hover.col.width - ADD_W / 2,
            top: hover.col.top,
            width: ADD_W,
            height: hover.col.height,
          }}
          onMouseDown={preventFocus}
          onClick={run(() => chainAt(lastOfRow()).addColumnAfter().run())}
        >
          <PlusIcon className="size-4" />
        </button>
      )}

      {/* Handle de columna: MONTADO sobre el borde superior de la columna hovered —
          el espacio entre la tabla y el texto de arriba queda libre. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-table-ctrl=""
            data-testid="table-col-menu"
            aria-label="Menú de columna"
            className={ctlCls}
            style={{
              left: hover.col.left + hover.col.width / 2,
              top: hover.col.top - BTN / 2,
              transform: "translateX(-50%)",
            }}
            onMouseDown={preventFocus}
          >
            <ChevronDownIcon className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-40">
          {colMenu}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* + de columna: debajo del borde (addRowAfter) — solo en la última fila, centrado
          en toda la anchura de la fila. */}
      {isLastRow && (
        <button
          type="button"
          data-table-ctrl=""
          data-testid="table-col-add"
          aria-label="Añadir fila"
          className={addCls}
          style={{
            left: hover.row.left,
            top: hover.row.top + hover.row.height - ADD_W / 2,
            width: hover.row.width,
            height: ADD_W,
          }}
          onMouseDown={preventFocus}
          onClick={run(() => chainAt(lastOfColumn()).addRowAfter().run())}
        >
          <PlusIcon className="size-4" />
        </button>
      )}
    </div>
  )
}
