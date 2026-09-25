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
// menú del ⋮⋮ y el overlay de la guía. Todo botón usa mousedown → preventDefault para no
// robar el foco de la selección. Skip: unique-id (el plugin no lee ids y meterlo grabaría
// `id` en el JSON persistido de cada nota); auto-scroll (notas cortas).

const btnCls =
  "pointer-events-auto grid size-[18px] place-items-center rounded-[4px] border border-popover bg-popover text-fg-secondary shadow-sm hover:bg-muted hover:text-foreground"

const itemIcon = "size-3.5 text-fg-secondary"

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
// TableHoverControls). `width` = ancho del bloque destino.
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

  // Durante el drag, dragover sobre el editor ubica la línea guía.
  useEffect(() => {
    if (!dragging) return
    const onDragOver = (e: DragEvent) => {
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
        onNodeChange={({ node, pos }) => {
          target.current = node && pos >= 0 ? { node, pos } : null
        }}
        onElementDragStart={() => setDragging(true)}
      >
        <div className="flex items-start gap-[2px]">
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
            <PlusIcon className="size-3" />
          </button>

          {/* ⋮⋮: click selecciona el bloque (node-range), Shift+click extiende, drag mueve.
              El menú lockea el handle (el plugin lo esconde al salir del editor y con el
              menú abierto el mouse viaja al portal del DropdownMenu). */}
          <DropdownMenu
            onOpenChange={(open) =>
              editor.view.dispatch(editor.view.state.tr.setMeta("lockDragHandle", open))
            }
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-testid="block-handle"
                aria-label="Menú de bloque"
                className={btnCls}
                onMouseDown={(e) => {
                  preventFocus(e)
                  selectBlock(e.shiftKey)
                }}
              >
                <GripVerticalIcon className="size-3" />
              </button>
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
            <div
              data-testid="drop-line"
              className="absolute rounded-full bg-fg-accent"
              style={{ top: line.top, left: line.left, width: line.width, height: 2 }}
            />
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
