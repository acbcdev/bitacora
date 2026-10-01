import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { ReactNode, RefObject } from "react"
import { DragHandle } from "@tiptap/extension-drag-handle-react"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { Node } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import type { Selection, Transaction } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
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

// Mapeo por Y (contrato v2 de visibilidad): el bloque más cercano al cursor (distancia al
// intervalo vertical de su rect — 0 si lo contiene). Desciende un nivel en contenedores de
// bloques (lista → ítem, blockquote → párrafo) para que el gutter al lado de un ítem ancle
// ese ítem, como Notion.
function blockAtY(view: EditorView, y: number): BlockTarget | null {
  // Fuera de la extensión vertical del contenido (header de la pantalla, pie): null.
  const doc = view.state.doc
  if (!doc.childCount) return null
  const firstDom = view.nodeDOM(0)
  const lastDom = view.nodeDOM(doc.content.size - doc.lastChild!.nodeSize)
  if (firstDom instanceof HTMLElement && lastDom instanceof HTMLElement) {
    const top = firstDom.getBoundingClientRect().top
    const bottom = lastDom.getBoundingClientRect().bottom
    if (y < top || y > bottom) return null
  }
  const pick = (parent: Node, basePos: number): BlockTarget | null => {
    let best: BlockTarget | null = null
    let bestDist = Infinity
    let pos = basePos
    for (let i = 0; i < parent.childCount; i++) {
      const child = parent.child(i)
      const dom = view.nodeDOM(pos)
      if (dom instanceof HTMLElement) {
        const box = dom.getBoundingClientRect()
        const dist = Math.max(box.top - y, y - box.bottom, 0)
        if (dist < bestDist) {
          bestDist = dist
          // Contenedor de bloques (lista, blockquote): anclar al hijo en esa altura.
          const first = child.firstChild
          best =
            first?.isBlock && child.childCount >= 1
              ? (pick(child, pos + 1) ?? { node: child, pos })
              : { node: child, pos }
        }
      }
      pos += child.nodeSize
    }
    return best
  }
  return pick(view.state.doc, 0)
}

// Key de las decoraciones del multi-select de bloques (compartido plugin/componente).
const selDecoKey = new PluginKey("blockSelDeco")

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
  const menuOpenRef = useRef(false)
  useEffect(() => {
    menuOpenRef.current = menuOpen
  }, [menuOpen])

  // Zona muerta del wrapper del asa (padding de gracia + ::after de index.css): click
  // ahí NO roba el foco del editor. Listener nativo: el wrapper lo crea el plugin por
  // fuera de React (portal) y no acepta handlers; el ref del contenido portalado
  // llega a él por parentNode. Solo la zona muerta (target === wrapper): el grip no
  // puede cancelar el mousedown (el drag nativo es su acción default).
  const innerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const wrap = innerRef.current?.parentElement
    if (!wrap) return
    const onMouseDown = (e: MouseEvent) => {
      if (e.target === wrap) e.preventDefault()
    }
    wrap.addEventListener("mousedown", onMouseDown)
    return () => wrap.removeEventListener("mousedown", onMouseDown)
  }, [])

  // Selección de bloques (multi-select NO contiguo): la lleva ESTA capa — un set de
  // bloques que se arma con clicks en ⋮⋮ ("this + next this": cada click AGREGA el
  // bloque, no reemplaza) y con node-ranges contiguos (Shift+click extiende, drag del
  // plugin). El PM selection queda en node-range sobre el ÚLTIMO bloque clicado: drag y
  // suppression del bubble del plugin siguen andando; el halo de los bloques FUERA de
  // ese rango lo pinta tagHalos (misma clase que pinta el plugin para el suyo).
  const [selBlocks, setSelBlocks] = useState<GutterBlock[]>([])
  const selRef = useRef<Array<{ pos: number; node: Node }>>([])
  const prevPmSel = useRef<Selection | null>(null)
  // Bloque donde está parada el asa del plugin (hover): su gutter propio se retira —
  // sin doble gutter. -1 = asa escondida o en otra parte.
  const [pluginHoverPos, setPluginHoverPos] = useState(-1)

  const withRects = (list: Array<{ pos: number; node: Node }>): GutterBlock[] => {
    const h = host.current
    if (!h) return []
    const hostBox = h.getBoundingClientRect()
    return list.flatMap((b) => {
      const dom = editor.view.nodeDOM(b.pos)
      if (!(dom instanceof HTMLElement)) return []
      const rect = firstLineRect(dom) ?? dom.getBoundingClientRect()
      return [
        {
          pos: b.pos,
          node: b.node,
          left: rect.left - hostBox.left,
          top: rect.top - hostBox.top,
          height: rect.height,
        },
      ]
    })
  }

  // Empuja las posiciones del set al plugin de decoraciones (halo nativo de PM). El
  // dispatch es meta-only (no toca doc/selection) y solo si cambió algo (sin bucle).
  const lastDecoPosRef = useRef<number[]>([])
  const updateDecos = (blocks: GutterBlock[]) => {
    const positions = blocks.map((b) => b.pos)
    if (JSON.stringify(positions) === JSON.stringify(lastDecoPosRef.current)) return
    lastDecoPosRef.current = positions
    queueMicrotask(() => {
      editor.view.dispatch(editor.view.state.tr.setMeta(selDecoKey, positions))
    })
  }

  // ⋮⋮ click: agrega el bloque al set (multi-select) y deja el PM selection en node-range
  // sobre él (drag/bubble del plugin). Idempotente; valida contra el doc vivo (un undo
  // puede borrar el bloque bajo el mouse).
  const addToSel = (t: BlockTarget) => {
    if (!t.node.eq(editor.state.doc.nodeAt(t.pos) ?? ({} as Node))) return
    if (!selRef.current.some((b) => b.pos === t.pos)) {
      selRef.current = [...selRef.current, { pos: t.pos, node: t.node }]
    }
    editor.view.dispatch(
      editor.view.state.tr
        .setSelection(NodeRangeSelection.create(editor.state.doc, t.pos, t.pos + t.node.nodeSize))
        .setMeta("blockSel", true),
    )
  }

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
  // mouseleave del editor y solo la revive con un mousemove sobre el texto. La detección
  // de zona es PROPIA de esta capa y escucha en DOCUMENT, no en el host: el asa vive
  // FUERA del box del host (a la izquierda del texto, sobre el padding del contenedor de
  // la nota) — con listeners en el host, cruzar hacia ella dispara el mouseleave y la
  // mata justo antes de llegar. Zona: franja izquierda del contenteditable a la altura
  // del contenido, mapeo por Y al bloque más cercano (los gaps entre bloques incluidos).
  // Sobre el texto manda el plugin; el resto (bajo el último bloque, sobre el header,
  // controles de tabla, bubble) esconde. Sin eventos sintéticos al plugin: si su
  // currentNode quedó reseteado, el dragstart resuelve el rango desde las coords.
  useEffect(() => {
    const hide = () => {
      if (menuOpenRef.current) return
      setPluginHoverPos(-1)
      const el = document.querySelector<HTMLElement>(".block-drag-handle")
      if (el) {
        el.style.visibility = "hidden"
        el.style.pointerEvents = "none"
      }
    }
    const onMove = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t) return
      if (editor.view.dom.contains(t)) return
      if (t.closest(".block-drag-handle")) return
      const domBox = editor.view.dom.getBoundingClientRect()
      const h = host.current
      if (!h) return
      // Menú abierto (asa o gutter): el target queda congelado sobre su bloque — blockAtY
      // mapearía por Y al bloque bajo el menú y haría operar el menú sobre el equivocado.
      if (menuOpenRef.current) return
      // Franja izquierda del editor. clientX >= borde = columna de contenido (outline,
      // controles de tabla, bubble…): ahí no aparece el asa.
      if (e.clientX >= domBox.left) {
        hide()
        return
      }
      const block = blockAtY(editor.view, e.clientY)
      // Fuera de la extensión vertical del contenido (header de la pantalla, pie): esconder.
      if (!block) {
        hide()
        return
      }
      target.current = block
      // El asa del plugin queda parada aquí: el gutter propio de ESTE bloque se retira.
      setPluginHoverPos(block.pos)
      const el = h.querySelector<HTMLElement>(".block-drag-handle")
      const dom = editor.view.nodeDOM(block.pos)
      if (!el || !(dom instanceof HTMLElement)) return
      el.style.visibility = ""
      el.style.pointerEvents = "auto"
      positionHandle(el, firstLineRect(dom) ?? dom.getBoundingClientRect(), h)
    }
    // Scroll (wheel en la franja incluido) mueve los bloques bajo el asa: esconder; el
    // próximo mousemove la re-muestra en su posición.
    document.addEventListener("mousemove", onMove)
    document.addEventListener("scroll", hide, true)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("scroll", hide, true)
    }
    // menuOpen vive en menuOpenRef (no re-suscribir por cada toggle del menú).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, host])

  // Decoraciones del multi-select: la clase del halo la aplica PM vía decorations del
  // plugin — NUNCA classList manual (el update de decoraciones de otros plugins pisa
  // clases agregadas a mano). Estado = posiciones; docChanged las remapea.
  useEffect(() => {
    const plugin = new Plugin({
      key: selDecoKey,
      state: {
        init: () => [] as number[],
        apply: (tr, value) => {
          const meta = tr.getMeta(selDecoKey)
          if (meta !== undefined) return meta as number[]
          if (!tr.docChanged) return value
          return value.map((p) => tr.mapping.map(p, 1)).filter((p) => p >= 0)
        },
      },
      props: {
        decorations: (state) => {
          const positions = selDecoKey.getState(state) as number[]
          console.log("DECOS", JSON.stringify(positions))
          if (!positions?.length) return DecorationSet.empty
          const { doc } = state
          const decos = positions.flatMap((pos) => {
            const node = doc.nodeAt(pos)
            if (!node) return []
            return [
              Decoration.node(pos, pos + node.nodeSize, {
                class: "ProseMirror-selectednoderange",
              }),
            ]
          })
          return DecorationSet.create(doc, decos)
        },
      },
    })
    editor.registerPlugin(plugin)
    return () => {
      editor.unregisterPlugin(selDecoKey)
    }
  }, [editor])

  // Sincroniza el set con el editor en cada transacción: un node-range contiguo externo
  // (Shift+click, drag del plugin, restauración tras drop) lo sobreescribe; el caret
  // moviéndose (texto) lo limpia; ediciones de doc remapean posiciones. Scroll
  // recalcula rects (los bloques se movieron bajo los gutters).
  useEffect(() => {
    const sync = (tr?: Transaction) => {
      const selection = editor.state.selection
      const pmSelChanged = selection !== prevPmSel.current
      prevPmSel.current = selection
      if (tr?.getMeta("blockSel") == null) {
        if (selection instanceof NodeRangeSelection && pmSelChanged) {
          // Rango contiguo externo (shift+click, drag, restauración): manda él. Solo si
          // CAMBIÓ — transacciones meta-only (nuestras decoraciones) no tocan el set.
          selRef.current = selection.ranges.flatMap((r) => {
            const node = r.$from.nodeAfter
            return node ? [{ pos: r.$from.pos, node }] : []
          })
        } else if (!(selection instanceof NodeRangeSelection) && pmSelChanged) {
          selRef.current = []
        }
        if (tr?.docChanged && selRef.current.length) {
          selRef.current = selRef.current.flatMap((b) => {
            const pos = tr.mapping.map(b.pos, 1)
            const node = editor.state.doc.nodeAt(pos)
            return node && node.eq(b.node) ? [{ pos, node }] : []
          })
        }
      }
      const blocks = withRects(selRef.current)
      setSelBlocks(blocks)
      updateDecos(blocks)
    }
    editor.on("transaction", ({ transaction }) => sync(transaction))
    const onScroll = () => sync()
    document.addEventListener("scroll", onScroll, true)
    return () => {
      editor.off("transaction", ({ transaction }) => sync(transaction))
      document.removeEventListener("scroll", onScroll, true)
    }
    // withRects/tagHalos solo leen refs y el editor (estables).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const selectBlock = (shift: boolean) => {
    const t = target.current
    if (!t) return
    if (!shift) {
      // Click simple: AGREGA el bloque al multi-select (no reemplaza la selección).
      addToSel(t)
      return
    }
    // Shift: extiende el rango desde el anchor actual hasta cubrir el bloque (contiguo:
    // sin meta, el sync lo adopta como set).
    const doc = editor.state.doc
    const to = t.pos + t.node.nodeSize
    const anchor = editor.state.selection.anchor
    editor.view.dispatch(
      editor.view.state.tr.setSelection(NodeRangeSelection.create(doc, anchor, to)),
    )
    editor.view.focus()
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
          setPluginHoverPos(pos >= 0 ? pos : -1)
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
        <div ref={innerRef} className="flex items-center gap-1.5 pr-2">
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
              {/* inline-flex (NO contents): Radix ancla el menú al rect del trigger — un
                  span display:contents no tiene box (getBoundingClientRect = 0,0) y el
                  menú abría en la esquina de la pantalla. */}
              <span className="inline-flex" onPointerDownCapture={(e) => e.stopPropagation()}>
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
                  // Contrato v4: click AGREGA el bloque al multi-select ("this + next
                  // this") y abre el menú; Shift+click extiende el rango contiguo. El
                  // drag agarra el bloque/rango sin pasar por acá (el node-range lo fija
                  // el propio plugin en el dragstart). SIN preventDefault: iniciar el
                  // drag es una acción default del mousedown — cancelarlo lo mata.
                  onMouseDown={(e) => {
                    if (!e.shiftKey) return
                    selectBlock(true)
                    setTimeout(() => editor.view.focus(), 0)
                  }}
                  onClick={(e) => {
                    if (target.current) addToSel(target.current)
                    // Mod+click = solo multi-select, sin menú (Shift ya lo hacía: la
                    // selección se hace en mousedown; el click no existe tras el gesto).
                    if (e.metaKey || e.ctrlKey) return
                    setMenuOpen((o) => !o)
                  }}
                >
                  <GripVerticalIcon className="size-4" />
                </span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              {target.current ? blockMenu(target.current, editor) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DragHandle>

      {/* Gutters propios de la selección (multi-select): uno por bloque del set,
          excepto donde el asa del plugin está parada (sin doble gutter). Fuera durante
          el drag (el asa del plugin + la guía toman el control). */}
      {!dragging &&
        selBlocks
          .filter((rb) => rb.pos !== pluginHoverPos)
          .map((rb) => (
            <SelectionGutter
              key={rb.pos}
              editor={editor}
              rb={rb}
              onToggle={() => addToSel({ node: rb.node, pos: rb.pos })}
            />
          ))}

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

// Un bloque dentro de un node-range activo, con las coords (relativas al host) de su
// primera línea — donde se ancla su gutter propio.
type GutterBlock = { pos: number; node: Node; left: number; top: number; height: number }

// Items del menú de bloque, operando sobre el target t: el mismo menú para el asa de
// hover y para los gutters de la selección (cada uno fija su target al abrir). Los
// handlers capturan t en render y validan contra el doc vivo (un undo/edición externa
// puede borrar el bloque entre apertura y click).
function blockMenu(t: BlockTarget, editor: Editor): ReactNode {
  const stale = () => !t.node.eq(editor.state.doc.nodeAt(t.pos) ?? ({} as Node))
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <TypeIcon className={itemIcon} /> Convertir a
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-40">
          {CONVERTS.map((c) => (
            <DropdownMenuItem
              key={c.label}
              disabled={!c.can(editor)}
              onSelect={() => {
                if (stale()) return
                c.apply(editor, t)
              }}
            >
              <span className="[&>svg]:size-3.5">{c.icon}</span> {c.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem
        onSelect={() => {
          if (stale()) return
          duplicate(editor)(t)
        }}
      >
        <CopyIcon className={itemIcon} /> Duplicar
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => {
          if (stale()) return
          editor.view.dispatch(editor.view.state.tr.delete(t.pos, t.pos + t.node.nodeSize))
        }}
      >
        <Trash2Icon className={itemIcon} /> Eliminar
      </DropdownMenuItem>
    </>
  )
}

// Gutter propio de un bloque seleccionado (node-range): IGUAL al asa de hover (+ ⋮⋮,
// mismas clases y mismo padding de gracia — .block-range-gutter en index.css) pero
// PERSISTENTE mientras dure la selección — uno por bloque del rango. Sin drag propio (el
// rango se arrastra desde cualquier asa del plugin: su dragstart cubre el node-range).
// Los handlers operan explícitamente sobre SU bloque (el plugin puede re-apuntar el
// target al bloque hovered en cualquier momento); el ⋮⋮ fija target al abrir para que
// blockMenu opere sobre él.
function SelectionGutter({
  editor,
  rb,
  onToggle,
}: {
  editor: Editor
  rb: GutterBlock
  onToggle: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // Misma matemática que positionHandle: borde derecho del gutter contra el borde
  // izquierdo del bloque, centrado en su primera línea (offsetWidth/Height leídos tras
  // el montaje — el CSS no los conoce de antemano).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.left = `${rb.left - el.offsetWidth}px`
    el.style.top = `${rb.top + rb.height / 2 - el.offsetHeight / 2}px`
  }, [rb])
  return (
    <div
      ref={ref}
      className="block-range-gutter absolute flex items-center gap-1.5"
      // Zona muerta (padding + ::after de index.css): click ahí no roba el foco.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) e.preventDefault()
      }}
    >
      <button
        type="button"
        data-testid={`range-add-${rb.pos}`}
        aria-label="Añadir bloque"
        className={btnCls}
        onMouseDown={preventFocus}
        onDragStart={(e) => e.preventDefault()}
        onClick={() => {
          const node = editor.state.doc.nodeAt(rb.pos)
          if (!node) return
          const after = rb.pos + node.nodeSize
          editor
            .chain()
            .insertContentAt(after, { type: "paragraph" })
            .setTextSelection(after + 1)
            .focus()
            .run()
        }}
      >
        <PlusIcon className="size-4" />
      </button>
      <DropdownMenu
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          editor.view.dispatch(editor.view.state.tr.setMeta("lockDragHandle", o))
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid={`range-handle-${rb.pos}`}
            aria-label="Menú de bloque"
            aria-haspopup="menu"
            aria-expanded={open}
            className={btnCls}
            onMouseDown={preventFocus}
            // Click agrega SU bloque al multi-select (sin robar foco); abrir/cerrar el
            // menú lo maneja Radix (trigger toggle en pointerdown, open controlado).
            onClick={onToggle}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          {blockMenu({ node: rb.node, pos: rb.pos }, editor)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
