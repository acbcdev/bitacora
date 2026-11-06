import { useEffect, useRef, useState } from "react"
import type { ReactNode, RefObject } from "react"
import { DragHandle } from "@tiptap/extension-drag-handle-react"
import type { NestedOptions } from "@tiptap/extension-drag-handle"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { Node } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import type { Selection, Transaction } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { EditorView } from "@tiptap/pm/view"
import type { Editor } from "@tiptap/react"
import {
  ClipboardIcon,
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
  SigmaIcon,
  SparklesIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { preventFocus } from "@/core/components/prevent-focus"
import { toast } from "sonner"
import { docToMarkdown, NODE } from "@/core/lib/tiptap-markdown"
import { editEmptyMath } from "@/core/components/ecuacion"

// Bloques: + ⋮⋮ en el margen izquierdo del bloque hovered (spec historia 6, issue 05).
// El drag (reordenar, rango multi-bloque, línea guía en drop) lo maneja el plugin oficial
// de @tiptap/extension-drag-handle + NodeRange; acá vive solo la UI: los dos glifos, el
// menú del ⋮⋮ y el overlay de la guía. Todo botón de overlay usa mousedown → preventDefault
// para no robar el foco — EXCEPCIÓN: el ⋮⋮, que no puede cancelarlo (el drag nativo es una
// acción default del mousedown: cancelarlo lo mata). Skip: unique-id (el plugin no lee ids
// y meterlo grabaría `id` en el JSON persistido de cada nota); auto-scroll (notas cortas).

const btnCls =
  "pointer-events-auto grid size-7 cursor-grab place-items-center rounded-md border border-popover bg-popover text-fg-secondary shadow-sm hover:bg-muted hover:text-foreground active:cursor-grabbing"

const itemIcon = "size-4 text-fg-secondary"

// Constante de módulo (NO inline): el useEffect del DragHandle depende de esta config —
// un objeto nuevo por render re-registraba el plugin entero y re-escondía el asa
// (visibility: hidden) en cada re-render del editor (autosave, refetch...).
const POSITION_CONFIG = { placement: "left", strategy: "absolute" } as const

// Desplegable (editor-blocks/01): summary y content son estructura (como tableRow/tableCell en
// las reglas default), nunca target — hover en el título agarra el bloque entero; los bloques
// del cuerpo siguen siendo arrastrables solos.
const NESTED_CONFIG: NestedOptions = {
  rules: [
    {
      id: "detailsParts",
      evaluate: ({ node }) =>
        node.type.name === NODE.detailsSummary || node.type.name === NODE.detailsContent ? 1000 : 0,
    },
  ],
}

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
  // blockMath es atom (sin contenido, solo attrs.latex): no se transforma, se reemplaza el
  // nodo. El texto del bloque pasa a ser el LaTeX; bloque vacío → editor de ecuación.
  {
    label: "Ecuación",
    icon: <SigmaIcon />,
    can: () => true,
    apply: (e, t) => {
      const item = t.node.type.name === "listItem" || t.node.type.name === "taskItem"
      // Ítem: solo su primer párrafo (textContent del ítem incluye las sublistas).
      const latex = (item ? t.node.firstChild : t.node)?.textContent.trim() ?? ""
      const math = { type: NODE.blockMath, attrs: { latex } }
      if (!item) {
        e.chain()
          .focus()
          .insertContentAt({ from: t.pos, to: t.pos + t.node.nodeSize }, math)
          .run()
      } else {
        // blockMath no cabe en bulletList/taskList: reemplazar el ítem directo partía la lista
        // y dejaba un resto arriba. Primero lift (el ítem sale como párrafo), luego se reemplaza.
        e.chain()
          .setTextSelection(t.pos + 2)
          .focus()
          .liftListItem(t.node.type.name)
          .command(({ tr }) => {
            const $p = tr.selection.$from
            tr.replaceWith($p.before(), $p.after(), e.schema.nodeFromJSON(math))
            return true
          })
          .run()
      }
      if (!latex) editEmptyMath(e.view)
    },
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
// dejaban el asa al medio). Sin texto (imagen, tabla) → franja de arriba del bloque: el asa
// arranca arriba, nunca al medio de una imagen alta.
// Altura de la línea, pero x del BLOQUE: el primer texto puede arrancar corrido (título del
// Desplegable tras el chevron, to-do tras el checkbox, callout tras el ícono) y el asa
// quedaba encima de esos controles. Textblock vacío (título de Desplegable recién creado): no
// hay texto, solo el <br> de ProseMirror — su línea es el textblock que lo contiene.
// x del asa. listItem: la viñeta vive FUERA del li (en el pl-5 del ul) — contra el li el asa
// quedaba encima de ella. Lista top-level u ol: borde de la lista (misma columna que el resto
// de los bloques; "10." es más ancho). ul anidado: 12px = ancho del disc + su aire, el asa
// abraza la viñeta (marca el anidamiento). taskItem (data-type) trae el checkbox dentro del li.
const blockLeft = (dom: HTMLElement) => {
  const left = dom.getBoundingClientRect().left
  if (dom.tagName !== "LI" || dom.dataset.type) return left
  const list = dom.parentElement!
  const topLevel = list.parentElement?.classList.contains("ProseMirror")
  return topLevel || list.tagName === "OL" ? list.getBoundingClientRect().left : left - 12
}

function firstLineRect(dom: HTMLElement): DOMRect {
  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    let box: DOMRect
    // Text, no `instanceof HTMLElement`: KaTeX mete MathML (<math>, <mi>) que NO es
    // HTMLElement — caía a la rama de texto y `data.trim()` tiraba, matando el asa.
    if (!(n instanceof Text)) {
      if (!(n as Element).classList.contains("ProseMirror-trailingBreak")) continue
      box = n.parentElement!.getBoundingClientRect()
    } else {
      const t = n
      if (!t.data.trim()) continue
      const range = document.createRange()
      range.setStart(t, 0)
      range.setEnd(t, Math.min(1, t.data.length))
      box = range.getBoundingClientRect()
    }
    if (box.height > 0) return new DOMRect(blockLeft(dom), box.top, box.width, box.height)
  }
  // Imagen: va centrada en un wrapper de ancho completo — el asa se pega a la imagen, no al
  // wrapper (estilo Notion).
  const box = (dom.querySelector("img") ?? dom).getBoundingClientRect()
  // 28 = alto de los botones del asa (size-7).
  return new DOMRect(box.left, box.top, box.width, Math.min(box.height, 28))
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
          // Contenedor de bloques (lista, blockquote): anclar al hijo en esa altura. El
          // Desplegable no: su primer hijo es el summary, que no se mueve solo.
          // ponytail: el gutter ancla el Desplegable entero; los bloques del cuerpo se agarran
          // por hover sobre el contenido (regla NESTED_CONFIG). Descender a detailsContent
          // si se pide.
          const first = child.firstChild
          best =
            first?.isBlock && child.childCount >= 1 && child.type.name !== NODE.details
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
  // bloques que se arma con clicks en ⋮⋮ (estilo explorador: Mod+click AGREGA, click
  // simple fuera del set reemplaza) y con node-ranges contiguos (Shift+click extiende, drag del
  // plugin). El PM selection queda en node-range sobre el ÚLTIMO bloque clicado: drag y
  // suppression del bubble del plugin siguen andando; el halo de los bloques FUERA de
  // ese rango lo pinta el plugin de decoraciones (misma clase que el de NodeRange).
  const selRef = useRef<Array<{ pos: number; node: Node }>>([])
  const prevPmSel = useRef<Selection | null>(null)

  // Empuja las posiciones del set al plugin de decoraciones (halo nativo de PM). El
  // dispatch es meta-only (no toca doc/selection) y solo si cambió algo (sin bucle).
  const lastDecoPosRef = useRef<number[]>([])
  const updateDecos = (blocks: Array<{ pos: number }>) => {
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
      // Menú abierto: el target queda congelado sobre su bloque — blockAtY
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
      const el = h.querySelector<HTMLElement>(".block-drag-handle")
      const dom = editor.view.nodeDOM(block.pos)
      if (!el || !(dom instanceof HTMLElement)) return
      el.style.visibility = ""
      el.style.pointerEvents = "auto"
      positionHandle(el, firstLineRect(dom), h)
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
    // Reemplaza cualquier instancia previa con la misma key: unregisterPlugin es no-op si
    // la view aún no está montada (isDestroyed === true sin editorView) y el re-run del
    // effect (StrictMode / remount) chocaba con "Adding different instances of a keyed plugin".
    editor.registerPlugin(plugin, (p, plugins) => [
      ...plugins.filter((x) => x.spec.key !== selDecoKey),
      p,
    ])
    return () => {
      editor.unregisterPlugin(selDecoKey)
    }
  }, [editor])

  // Sincroniza el set con el editor en cada transacción: un node-range contiguo externo
  // (Shift+click, drag del plugin, restauración tras drop) lo sobreescribe; el caret
  // moviéndose (texto) lo limpia; ediciones de doc remapean posiciones.
  useEffect(() => {
    const sync = (tr: Transaction) => {
      const selection = editor.state.selection
      const pmSelChanged = selection !== prevPmSel.current
      prevPmSel.current = selection
      if (tr.getMeta("blockSel") == null) {
        if (selection instanceof NodeRangeSelection && pmSelChanged) {
          // Rango contiguo externo (shift+click, drag, restauración): manda él. Solo si
          // CAMBIÓ — transacciones meta-only (nuestras decoraciones) no tocan el set.
          selRef.current = selection.ranges.flatMap((r) => {
            const node = r.$from.nodeAfter
            return node ? [{ pos: r.$from.pos, node }] : []
          })
        } else if (!(selection instanceof NodeRangeSelection) && pmSelChanged) {
          selRef.current = []
        } else if (tr.docChanged && selRef.current.length) {
          // else: un set recién armado desde la selección ya está en coords del doc nuevo —
          // re-mapearlo lo corría fuera del doc (doc + selección cambian juntos: ⌘D).
          selRef.current = selRef.current.flatMap((b) => {
            const pos = tr.mapping.map(b.pos, 1)
            const node = editor.state.doc.nodeAt(pos)
            return node && node.eq(b.node) ? [{ pos, node }] : []
          })
        }
      }
      updateDecos(selRef.current)
    }
    const onTr = ({ transaction }: { transaction: Transaction }) => sync(transaction)
    editor.on("transaction", onTr)
    return () => {
      editor.off("transaction", onTr)
    }
    // updateDecos solo lee refs y el editor (estables).
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
        nested={NESTED_CONFIG}
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
          const rect = firstLineRect(dom)
          return { getBoundingClientRect: () => rect }
        }}
        onElementDragStart={() => setDragging(true)}
      >
        {/* pr-2: aire entre el asa y el texto — floating-ui pega el borde derecho del wrapper
            (cuenta todo el box, padding incluido) al borde izquierdo del bloque. */}
        <div ref={innerRef} className="flex items-center gap-0.5 pr-2">
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
            <PlusIcon className="size-4.5" />
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
                  // Contrato v5: click selecciona (Mod+click agrega al multi-select) y
                  // abre el menú; Shift+click extiende el rango contiguo. El
                  // drag agarra el bloque/rango sin pasar por acá (el node-range lo fija
                  // el propio plugin en el dragstart). SIN preventDefault: iniciar el
                  // drag es una acción default del mousedown — cancelarlo lo mata.
                  onMouseDown={(e) => {
                    if (!e.shiftKey) return
                    selectBlock(true)
                    setTimeout(() => editor.view.focus(), 0)
                  }}
                  onClick={(e) => {
                    const t = target.current
                    // Estilo explorador de archivos: click simple sobre un bloque FUERA del
                    // set lo reemplaza; Mod+click agrega; click sobre uno ya seleccionado
                    // conserva el set (el menú opera sobre todos).
                    const mod = e.metaKey || e.ctrlKey
                    if (t && !mod && !selRef.current.some((b) => b.pos === t.pos)) {
                      selRef.current = []
                    }
                    if (t) addToSel(t)
                    // Mod+click = solo multi-select, sin menú (Shift ya lo hacía: la
                    // selección se hace en mousedown; el click no existe tras el gesto).
                    // Foco al editor: si queda en el ⋮⋮, el Esc global (editor.tsx) lo ignora.
                    if (mod) return editor.view.focus()
                    setMenuOpen((o) => !o)
                  }}
                >
                  <GripVerticalIcon className="size-4.5" />
                </span>
              </span>
            </DropdownMenuTrigger>
            {/* Al cerrar, el foco vuelve al editor (no al trigger): si no, el Esc que
                limpia la selección de bloques no llega (exige editor.view.hasFocus()). */}
            <DropdownMenuContent
              align="start"
              className="min-w-44"
              onCloseAutoFocus={(e) => {
                e.preventDefault()
                // Desmontar el editor con el menú abierto también lo cierra (sin view).
                if (!editor.isDestroyed) editor.view.focus()
              }}
            >
              {target.current ? blockMenu(target.current, editor) : null}
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
                className="absolute size-2 rounded-full bg-foreground"
                style={{ top: line.top - 3, left: line.left - 3 }}
              />
              <div
                data-testid="drop-line"
                className="absolute rounded-full bg-foreground"
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

// Header del menú (estilo Notion): tipo del bloque. Nodo sin entrada → sin header.
const BLOCK_LABELS: Record<string, string> = {
  paragraph: "Párrafo",
  bulletList: "Lista",
  orderedList: "Lista numerada",
  taskList: "To-do",
  blockquote: "Cita",
  codeBlock: "Código",
  horizontalRule: "Divisor",
  table: "Tabla",
  image: "Imagen",
  [NODE.blockMath]: "Ecuación en bloque",
  [NODE.callout]: "Callout",
  [NODE.details]: "Desplegable",
}
const labelOf = (n: Node) =>
  n.type.name === "heading" ? `Heading ${n.attrs.level}` : BLOCK_LABELS[n.type.name]
// El gutter baja hasta el textblock (lista → ítem → párrafo, callout → párrafo): un párrafo
// anidado toma el label del ancestro más cercano con nombre (Lista, Callout, Cita, Tabla...).
export function blockLabel(doc: Node, t: BlockTarget) {
  if (t.node.type.name !== "paragraph") return labelOf(t.node)
  const $p = doc.resolve(t.pos)
  for (let d = $p.depth; d > 0; d--) {
    const l = labelOf($p.node(d))
    if (l) return l
  }
  return labelOf(t.node)
}

// Copiar como Markdown. Ítem suelto: se envuelve en su lista padre (con sus attrs) para que
// salga con su marcador (`- `, `1. `, `- [ ] `) — un listItem pelado no serializa.
async function copyMarkdown(editor: Editor, t: BlockTarget) {
  const parent = editor.state.doc.resolve(t.pos).parent
  const node = t.node.type.name.endsWith("Item")
    ? { type: parent.type.name, attrs: parent.attrs, content: [t.node.toJSON()] }
    : t.node.toJSON()
  await navigator.clipboard.writeText(docToMarkdown({ type: "doc", content: [node] }))
  toast.success("Bloque copiado")
}

// Items del menú de bloque, operando sobre el target t: el mismo menú para el asa de
// hover (fija su target al abrir). Los
// handlers capturan t en render y validan contra el doc vivo (un undo/edición externa
// puede borrar el bloque entre apertura y click).
function blockMenu(t: BlockTarget, editor: Editor): ReactNode {
  const stale = () => !t.node.eq(editor.state.doc.nodeAt(t.pos) ?? ({} as Node))
  const label = blockLabel(editor.state.doc, t)
  return (
    <>
      {label && <DropdownMenuLabel className="text-fg-secondary">{label}</DropdownMenuLabel>}
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
        <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          if (stale()) return
          void copyMarkdown(editor, t)
        }}
      >
        <ClipboardIcon className={itemIcon} /> Copiar
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          if (stale()) return
          editor.view.dispatch(editor.view.state.tr.delete(t.pos, t.pos + t.node.nodeSize))
        }}
      >
        <Trash2Icon className={itemIcon} /> Eliminar
        <DropdownMenuShortcut>Del</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {/* ponytail: placeholder sin backend IA — feature propia cuando exista spec. */}
      <DropdownMenuItem disabled>
        <SparklesIcon className={itemIcon} /> Preguntar a la IA
        <DropdownMenuShortcut className="tracking-normal">Pronto</DropdownMenuShortcut>
      </DropdownMenuItem>
    </>
  )
}
