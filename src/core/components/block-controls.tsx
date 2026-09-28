import { useEffect, useRef, useState } from "react"
import type { ReactNode, RefObject } from "react"
import { DragHandle } from "@tiptap/extension-drag-handle-react"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { Node } from "@tiptap/pm/model"
import type { EditorView } from "@tiptap/pm/view"
import type { Editor } from "@tiptap/react"
import {
  CodeIcon,
  CopyIcon,
  GripVerticalIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListTodoIcon,
  PlusIcon,
  QuoteIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { preventFocus } from "@/core/components/prevent-focus"

// Bloques: + ⋮⋮ en el margen izquierdo del bloque hovered (spec historia 6, issue 05).
// El drag (reordenar, rango multi-bloque, línea guía en drop) lo maneja el plugin oficial
// de @tiptap/extension-drag-handle + NodeRange; acá vive solo la UI: los dos glifos, el
// menú del ⋮⋮ y el overlay de la guía. Todo botón de overlay usa mousedown → preventDefault
// para no robar el foco — EXCEPCIÓN: el ⋮⋮, que no puede cancelarlo (el drag nativo es una
// acción default del mousedown: cancelarlo lo mata). Skip: unique-id (el plugin no lee ids
// y meterlo grabaría `id` en el JSON persistido de cada nota); auto-scroll (notas cortas).

const btnCls =
  "pointer-events-auto grid size-6 cursor-grab place-items-center rounded-md border border-popover bg-popover text-fg-secondary shadow-sm hover:bg-muted hover:text-foreground active:cursor-grabbing"

const itemIcon = "size-4 text-fg-secondary"

// Constante de módulo (NO inline): el useEffect del DragHandle depende de esta config —
// un objeto nuevo por render re-registraba el plugin entero y re-escondía el asa
// (visibility: hidden) en cada re-render del editor (autosave, refetch...).
const POSITION_CONFIG = { placement: "left", strategy: "absolute" } as const

// Bloque bajo el handle (hover del plugin) — el menú siempre opera sobre él.
type BlockTarget = { node: Node; pos: number }

const CONVERTS: Array<{
  label: string
  icon: ReactNode
  can: (editor: Editor) => boolean
  apply: (editor: Editor, t: BlockTarget) => unknown
}> = [
  {
    label: "Párrafo",
    icon: <TypeIcon />,
    can: (e) => e.can().setParagraph(),
    apply: (e, t) => e.chain().setTextSelection(rangeOf(t)).focus().setParagraph().run(),
  },
  {
    label: "Heading 1",
    icon: <Heading1Icon />,
    can: (e) => e.can().setHeading({ level: 1 }),
    apply: (e, t) => e.chain().setTextSelection(rangeOf(t)).focus().setHeading({ level: 1 }).run(),
  },
  {
    label: "Heading 2",
    icon: <Heading2Icon />,
    can: (e) => e.can().setHeading({ level: 2 }),
    apply: (e, t) => e.chain().setTextSelection(rangeOf(t)).focus().setHeading({ level: 2 }).run(),
  },
  {
    label: "Heading 3",
    icon: <Heading3Icon />,
    can: (e) => e.can().setHeading({ level: 3 }),
    apply: (e, t) => e.chain().setTextSelection(rangeOf(t)).focus().setHeading({ level: 3 }).run(),
  },
  {
    label: "Lista",
    icon: <ListIcon />,
    can: (e) => e.can().toggleBulletList(),
    apply: (e, t) => e.chain().setTextSelection(rangeOf(t)).focus().toggleBulletList().run(),
  },
  {
    label: "To-do",
    icon: <ListTodoIcon />,
    can: (e) => e.can().toggleTaskList(),
    apply: (e, t) => e.chain().setTextSelection(rangeOf(t)).focus().toggleTaskList().run(),
  },
  {
    label: "Cita",
    icon: <QuoteIcon />,
    can: (e) => e.can().toggleBlockquote(),
    apply: (e, t) => e.chain().setTextSelection(rangeOf(t)).focus().toggleBlockquote().run(),
  },
  {
    label: "Código",
    icon: <CodeIcon />,
    can: (e) => e.can().toggleCodeBlock(),
    apply: (e, t) => e.chain().setTextSelection(rangeOf(t)).focus().toggleCodeBlock().run(),
  },
]

// Selección de texto dentro del contenido del bloque: los comandos de conversión
// (toggleList incluido) operan sobre ella y transforman el bloque entero.
const rangeOf = (t: BlockTarget) => ({ from: t.pos + 1, to: t.pos + t.node.nodeSize - 1 })

// Línea guía de 2px en el punto de drop, coordenadas relativas al host (mismo patrón que
// TableHoverControls). `width` = ancho del bloque destino. Sin highlight del bloque destino:
// la guía es la línea (y el dot), no un rect sobre el bloque (decisión del usuario).
type DropLine = { top: number; left: number; width: number }

function locateLine(
  view: EditorView,
  host: HTMLElement,
  dragged: Node | null,
  clientX: number,
  clientY: number,
): DropLine | null {
  const coords = view.posAtCoords({ left: clientX, top: clientY })
  if (!coords) return null
  const { doc } = view.state
  const $pos = doc.resolve(coords.pos)
  // Mismo nivel de hermanos que el nodo arrastrado: ítem de lista cae entre ítems,
  // bloque raíz cae entre bloques raíz.
  const name = dragged?.type.name
  let depth = 0
  let blockPos = -1
  if (name === "listItem" || name === "taskItem") {
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name === name) {
        depth = d
        break
      }
    }
    if (depth) blockPos = $pos.before(depth)
  }
  if (blockPos < 0) {
    depth = Math.min($pos.depth, 1)
    blockPos = depth > 0 ? $pos.before(depth) : coords.pos
  }
  const dom = view.nodeDOM(blockPos)
  if (!(dom instanceof HTMLElement)) return null
  const hostBox = host.getBoundingClientRect()
  const box = dom.getBoundingClientRect()
  return {
    // Mitad superior del bloque → línea arriba; mitad inferior → abajo.
    top: (clientY < box.top + box.height / 2 ? box.top : box.bottom) - hostBox.top - 1,
    left: box.left - hostBox.left,
    width: box.width,
  }
}

// Rect de la primera línea de texto del bloque: para centrar el asa en el PRINCIPIO del
// block (estilo Notion) en vez del centro vertical del bloque entero (párrafos largos
// dejaban el asa al medio). Sin texto (imagen, tabla) → fallback al rect completo.
function firstLineRect(dom: HTMLElement): DOMRect | null {
  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (!n.data.trim()) continue
    const range = document.createRange()
    range.setStart(n, 0)
    range.setEnd(n, Math.min(1, n.data.length))
    const box = range.getBoundingClientRect()
    if (box.height > 0) return box
  }
  return null
}

// Posiciona el asa contra la primera línea del bloque: borde derecho contra el borde
// izquierdo del ref, centrado vertical — la MISMA matemática que floating-ui aplica al
// plugin con placement "left" + strategy "absolute" (coordenadas relativas al offsetParent;
// el host es el ancestro posicionado y sin borde, así que su rect es el origen).
function positionHandle(el: HTMLElement, ref: DOMRect, host: HTMLElement) {
  const hostBox = host.getBoundingClientRect()
  el.style.left = `${ref.left - hostBox.left - el.offsetWidth}px`
  el.style.top = `${ref.top + ref.height / 2 - hostBox.top - el.offsetHeight / 2}px`
}

// Mapeo por Y (contrato v2 de visibilidad): el bloque cuyo rect vertical contiene el
// cursor. Desciende un nivel en contenedores de bloques (lista → ítem, blockquote →
// párrafo) para que el gutter al lado de un ítem ancle ese ítem, como Notion.
function blockAtY(view: EditorView, y: number): BlockTarget | null {
  const pick = (parent: Node, basePos: number): BlockTarget | null => {
    let pos = basePos
    for (let i = 0; i < parent.childCount; i++) {
      const child = parent.child(i)
      const dom = view.nodeDOM(pos)
      if (dom instanceof HTMLElement) {
        const box = dom.getBoundingClientRect()
        if (y >= box.top && y <= box.bottom) {
          const first = child.firstChild
          if (first?.isBlock && child.childCount > 1) return pick(child, pos + 1)
          return { node: child, pos }
        }
      }
      pos += child.nodeSize
    }
    return null
  }
  return pick(view.state.doc, 0)
}

export function BlockControls({
  editor,
  host,
}: {
  editor: Editor
  host: RefObject<HTMLElement | null>
}) {
  // Bloque bajo el cursor (el mismo que arrastra el plugin) y su pos.
  const target = useRef<{ node: Node; pos: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [line, setLine] = useState<DropLine | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  // Durante el drag, dragover sobre el editor ubica la línea guía. preventDefault: sin él
  // el navegador no marca el drop como válido (dragover default = negar el drop).
  useEffect(() => {
    if (!dragging) return
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (!host.current || !target.current) return
      setLine(locateLine(editor.view, host.current, target.current.node, e.clientX, e.clientY))
    }
    const clear = () => {
      setDragging(false)
      setLine(null)
    }
    const dom = editor.view.dom
    dom.addEventListener("dragover", onDragOver)
    document.addEventListener("dragend", clear)
    document.addEventListener("drop", clear)
    return () => {
      dom.removeEventListener("dragover", onDragOver)
      document.removeEventListener("dragend", clear)
      document.removeEventListener("drop", clear)
    }
  }, [dragging, editor, host])

  const withTarget = (fn: (t: BlockTarget) => void) => () => {
    const t = target.current
    if (!t) return
    // Un undo/edición externa puede borrar el bloque sin mover el mouse.
    if (!t.node.eq(editor.state.doc.nodeAt(t.pos) ?? ({} as Node))) return
    fn(t)
  }

  // Visibilidad del asa (contrato v2, grill 2026-09-27): el plugin la esconde en el
  // mouseleave del editor y solo la revive con un mousemove sobre el texto — que nunca
  // llega mientras el puntero esté en el gutter. La detección de zona es PROPIA de esta
  // capa: mousemove sobre el host que no cae en el contenteditable ni en el propio asa =
  // gutter; mapeo por Y → target + mostrar + posicionar contra la primera línea del
  // bloque. Sin eventos sintéticos al plugin: si su currentNode quedó reseteado por el
  // mouseleave, el dragstart resuelve el rango desde las coords del evento.
  useEffect(() => {
    const h = host.current
    if (!h) return
    const onMove = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || !h.contains(t)) return
      if (editor.view.dom.contains(t)) return
      if (t.closest(".block-drag-handle")) return
      const block = blockAtY(editor.view, e.clientY)
      if (!block) return
      target.current = block
      const el = h.querySelector<HTMLElement>(".block-drag-handle")
      if (!el) return
      el.style.visibility = ""
      el.style.pointerEvents = "auto"
      const dom = editor.view.nodeDOM(block.pos)
      if (!(dom instanceof HTMLElement)) return
      positionHandle(el, firstLineRect(dom) ?? dom.getBoundingClientRect(), h)
    }
    h.addEventListener("mousemove", onMove)
    return () => h.removeEventListener("mousemove", onMove)
  }, [editor, host])

  const selectBlock = (shift: boolean) => {
    const t = target.current
    if (!t) return
    const doc = editor.state.doc
    const to = t.pos + t.node.nodeSize
    const anchor = shift ? editor.state.selection.anchor : t.pos
    editor.view.dispatch(
      editor.view.state.tr.setSelection(NodeRangeSelection.create(doc, anchor, to)),
    )
    if (!shift) editor.view.focus()
  }

  return (
    <>
      {/* El wrapper del handle lo agrega el plugin a view.dom.parentElement (tiptap-host):
          floating-ui lo ubica a la izquierda del bloque hovered (placement left-start). */}
      <DragHandle
        editor={editor}
        className="block-drag-handle"
        nested
        // placement "left" centrado contra el virtual element de primera línea
        // (getReferencedVirtualElement): el asa queda alineada al principio del bloque.
        computePositionConfig={POSITION_CONFIG}
        onNodeChange={({ node, pos }) => {
          target.current = node && pos >= 0 ? { node, pos } : null
        }}
        // Centrar el asa (+ ⋮⋮) contra la PRIMERA LÍNEA del bloque (target.current lo fija
        // onNodeChange, que el plugin llama justo antes de re-posicionar).
        getReferencedVirtualElement={() => {
          const t = target.current
          if (!t) return null
          const dom = editor.view.nodeDOM(t.pos)
          if (!(dom instanceof HTMLElement)) return null
          const rect = firstLineRect(dom) ?? dom.getBoundingClientRect()
          return { getBoundingClientRect: () => rect }
        }}
        onElementDragStart={() => setDragging(true)}
      >
        {/* pr-2: aire entre el asa y el texto — floating-ui pega el borde derecho del wrapper
            (cuenta todo el box, padding incluido) al borde izquierdo del bloque. */}
        <div className="flex items-center gap-1.5 pr-2">
          {/* +: párrafo vacío debajo del bloque, enfocado (sin menú: escribir / ya abre slash). */}
          <button
            type="button"
            data-testid="block-add"
            aria-label="Añadir bloque"
            className={btnCls}
            onMouseDown={preventFocus}
            onDragStart={(e) => e.preventDefault()}
            onClick={withTarget((t) => {
              const after = t.pos + t.node.nodeSize
              editor
                .chain()
                .insertContentAt(after, { type: "paragraph" })
                .setTextSelection(after + 1)
                .focus()
                .run()
            })}
          >
            <PlusIcon className="size-4" />
          </button>

          {/* ⋮⋮: click selecciona el bloque (node-range), Shift+click extiende, drag mueve.
              El menú lockea el handle (el plugin lo esconde al salir del editor y con el
              menú abierto el mouse viaja al portal del DropdownMenu). */}
          <DropdownMenu
            open={menuOpen}
            onOpenChange={(open) => {
              setMenuOpen(open)
              editor.view.dispatch(editor.view.state.tr.setMeta("lockDragHandle", open))
            }}
          >
            {/* El trigger de Radix abre el menú en pointerdown y hace preventDefault — un
                pointerdown cancelado suprime el drag nativo en Chromium/Firefox: el ⋮⋮
                nunca arrastraba (abría el menú y moría). La captura corta ese handler sin
                cancelar nada; el menú abre en click (tras un drag no hay click, así que
                el gesto drag no dispara el menú). Enter/Space siguen abriendo vía Radix
                (el keydown del grip burbujea al trigger). */}
            <DropdownMenuTrigger asChild>
              <span className="contents" onPointerDownCapture={(e) => e.stopPropagation()}>
                {/* span con role=button, NO <button>: Chromium no inicia drag nativo desde
                    un form control ni con draggable=true (probado con Chrome headless —
                    dragstart solo dispara desde el wrapper). */}
                <span
                  role="button"
                  tabIndex={0}
                  data-testid="block-handle"
                  aria-label="Menú de bloque"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  draggable={!menuOpen}
                  className={btnCls}
                  // Contrato v2: click = SOLO menú, no toca la selección del editor (el
                  // drag agarra el bloque sin seleccionar; el node-range lo fija el
                  // propio plugin en el dragstart). La selección de bloque solo existe
                  // con Shift+click. SIN preventDefault: iniciar el drag es una acción
                  // default del mousedown — cancelarlo lo mata.
                  onMouseDown={(e) => {
                    if (!e.shiftKey) return
                    selectBlock(true)
                    setTimeout(() => editor.view.focus(), 0)
                  }}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <GripVerticalIcon className="size-4" />
                </span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <TypeIcon className={itemIcon} /> Convertir a
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-40">
                  {CONVERTS.map((c) => (
                    <DropdownMenuItem
                      key={c.label}
                      disabled={!c.can(editor)}
                      onSelect={withTarget((t) => c.apply(editor, t))}
                    >
                      <span className="[&>svg]:size-3.5">{c.icon}</span> {c.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={withTarget(duplicate(editor))}>
                <CopyIcon className={itemIcon} /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={withTarget((t) =>
                  editor.view.dispatch(editor.view.state.tr.delete(t.pos, t.pos + t.node.nodeSize)),
                )}
              >
                <Trash2Icon className={itemIcon} /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DragHandle>

      {/* Guía de drop: solo durante el drag, no captura el mouse. */}
      {dragging && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {line && (
            <>
              {/* Línea de drop + punto (estilo Notion): el dot marca exactamente el punto
                  de inserción al margen, la línea cruza todo el ancho del bloque destino. */}
              <div
                data-testid="drop-dot"
                className="absolute size-2 rounded-full bg-brand-strong"
                style={{ top: line.top - 3, left: line.left - 3 }}
              />
              <div
                data-testid="drop-line"
                className="absolute rounded-full bg-brand-strong"
                style={{ top: line.top, left: line.left, width: line.width, height: 2 }}
              />
            </>
          )}
        </div>
      )}
    </>
  )
}

// Duplicar = clone del nodo vía JSON + insert debajo (mismo build propio de la spec).
function duplicate(editor: Editor) {
  return (t: { node: Node; pos: number }) => {
    const clone = Node.fromJSON(editor.state.schema, t.node.toJSON())
    editor.view.dispatch(editor.view.state.tr.insert(t.pos + t.node.nodeSize, clone))
  }
}
