import { useEffect, useRef, useState } from "react"
import { GripVerticalIcon } from "lucide-react"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { Editor } from "@tiptap/react"
import type { BlockTarget } from "@/core/components/block-controls"
import {
  currentBlock,
  dropSlots,
  moveBlock,
  selectBlockAt,
} from "@/core/components/block-touch-actions"
import type { DropSlot } from "@/core/components/block-touch-actions"
import { BlockBar, BlockSheet } from "@/core/components/block-touch-ui"

// Mantener apretado un bloque lo levanta para arrastrarlo: el MISMO gesto en touch (BlockTouch) y
// con el mouse en desktop (BlockHoldDrag, al lado del gutter por hover de block-controls.tsx).
// Bloque = el más profundo bajo el dedo/cursor (sub-bloques incluidos).
const HOLD_MS = 350
const MOVE_SLOP = 8
const EDGE = 110 // px del borde donde el drag auto-scrollea

// Atenúa el bloque original mientras se arrastra. Decoración, NO `style` a mano: ProseMirror
// observa su DOM y una mutación ajena lo hace re-renderizar el nodo (la opacidad duraba un tick).
export const dimKey = new PluginKey<number | null>("holdDragDim")
const dimPlugin = new Plugin<number | null>({
  key: dimKey,
  state: {
    init: () => null,
    apply: (tr, pos) => (tr.getMeta(dimKey) !== undefined ? tr.getMeta(dimKey) : pos),
  },
  props: {
    decorations(state) {
      const pos = dimKey.getState(state)
      const node = pos == null ? null : state.doc.nodeAt(pos)
      if (pos == null || !node) return null
      return DecorationSet.create(state.doc, [
        Decoration.node(pos, pos + node.nodeSize, { style: "opacity: 0.25" }),
      ])
    },
  },
})

function useHoldDrag(editor: Editor, touch: boolean, onHold?: () => void) {
  const [dragging, setDragging] = useState(false)
  const lineRef = useRef<HTMLDivElement>(null)

  // Drag: clon del bloque pegado al dedo, original atenuado, línea guía donde va a caer.
  // La guía se mueve por ref (un setState por frame re-renderizaba todo el componente).
  function beginDrag(b: BlockTarget, y0: number, onEnd: (moved: boolean) => void) {
    const src = editor.view.nodeDOM(b.pos)
    const host = editor.view.dom.parentElement
    // ponytail: auto-scroll solo si el scroller es <main> (pantalla de nota). En un dialog la
    // rueda del mouse sigue scrolleando durante el drag; buscar el ancestro scrolleable si molesta.
    const scroller = editor.view.dom.closest("main")
    if (!(src instanceof HTMLElement)) return onEnd(false)
    const bEnd = b.pos + b.node.nodeSize
    const slots = dropSlots(editor, b)
    const r = src.getBoundingClientRect()
    // Fantasma = el bloque con el MISMO halo que la selección de bloque. No se copia el estilo: el
    // clon va dentro de un mini-árbol .tiptap-host > .ProseMirror para que le apliquen las reglas
    // reales del editor (halo, tipografía, viñetas, chevron). El div intermedio evita las reglas
    // de hijo directo (`.ProseMirror > *`: margen, heading al tope sin padding). Vive en <body>:
    // dentro de un dialog con transform, position: fixed dejaría de ser relativo al viewport.
    const clone = src.cloneNode(true) as HTMLElement
    clone.classList.add("ProseMirror-selectednoderange")
    clone.style.margin = "0"
    const ghost = document.createElement("div")
    ghost.className = "tiptap-host"
    const pm = ghost.appendChild(document.createElement("div"))
    pm.className = "ProseMirror"
    // El tamaño de letra depende del contexto del editor real (modo focus = más grande).
    pm.style.fontSize = getComputedStyle(editor.view.dom).fontSize
    pm.appendChild(document.createElement("div")).appendChild(clone)
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${r.left}px`,
      width: `${r.width}px`,
      top: `${r.top}px`,
      zIndex: "60",
      pointerEvents: "none",
    })
    document.body.appendChild(ghost)
    const dim = (pos: number | null) => editor.view.dispatch(editor.state.tr.setMeta(dimKey, pos))
    dim(b.pos)
    navigator.vibrate?.(10)
    setDragging(true)
    // Mouse: el botón sigue apretado, así que el browser seguiría extendiendo la selección de
    // texto con cada movimiento. Una selección dentro de un editable SIN foco no se extiende:
    // blur mientras dura (el foco vuelve al soltar). El atributo esconde el asa de hover y pone
    // el cursor de agarre (index.css).
    if (!touch) {
      editor.view.dom.blur()
      host?.setAttribute("data-hold-drag", "")
    }

    const grab = y0 - r.top
    let y = y0
    let target: DropSlot | null = null
    let moved = false
    let raf = 0
    // Hueco más cercano al dedo. Los sub-bloques de un Desplegable cerrado no tienen caja.
    const locate = () => {
      let best = Infinity
      let edge = 0
      let box: DOMRect | undefined
      target = null
      for (const slot of slots) {
        const rect = slot.dom.getBoundingClientRect()
        const at = slot.after ? rect.bottom : rect.top
        if (!rect.height || Math.abs(y - at) >= best) continue
        best = Math.abs(y - at)
        edge = at
        box = rect
        target = slot
      }
      const el = lineRef.current
      if (!el) return
      // Soltar donde ya está (o pegado a sí mismo) no mueve nada: sin guía. El ancho/sangría
      // de la guía es el del bloque vecino: se ve a qué nivel cae.
      const noop = !box || !target || (target.pos >= b.pos && target.pos <= bEnd)
      el.style.display = noop ? "none" : "block"
      el.style.top = `${edge - 1}px`
      el.style.left = `${box?.left ?? 0}px`
      el.style.width = `${box?.width ?? 0}px`
    }
    const tick = () => {
      if (scroller && y < EDGE) scroller.scrollTop -= 12
      else if (scroller && y > window.innerHeight - EDGE) scroller.scrollTop += 12
      ghost.style.top = `${y - grab}px`
      locate()
      raf = requestAnimationFrame(tick)
    }
    tick()
    const move = (e: PointerEvent) => {
      y = e.clientY
      if (Math.abs(y - y0) > MOVE_SLOP) moved = true
    }
    // Sin esto el dedo scrollea la página en vez de arrastrar el bloque.
    const noScroll = (e: TouchEvent) => e.preventDefault()
    const end = () => {
      cancelAnimationFrame(raf)
      document.removeEventListener("pointermove", move)
      document.removeEventListener("pointerup", end)
      document.removeEventListener("pointercancel", end)
      document.removeEventListener("touchmove", noScroll)
      ghost.remove()
      dim(null)
      setDragging(false)
      host?.removeAttribute("data-hold-drag")
      // El hueco se recalcula al soltar: el último frame puede ser anterior al último movimiento.
      locate()
      if (moved && target) moveBlock(editor, b, target.pos)
      if (!touch) editor.view.focus()
      onEnd(moved)
    }
    document.addEventListener("pointermove", move)
    document.addEventListener("pointerup", end)
    document.addEventListener("pointercancel", end)
    document.addEventListener("touchmove", noScroll, { passive: false })
  }

  // Mismo patrón que el plugin de decoraciones de block-controls: reemplaza la instancia previa
  // con la misma key (StrictMode / remount re-corren el effect).
  useEffect(() => {
    editor.registerPlugin(dimPlugin, (plugin, plugins) => [
      ...plugins.filter((x) => x.spec.key !== dimKey),
      plugin,
    ])
    return () => {
      editor.unregisterPlugin(dimKey)
    }
  }, [editor])

  // Mantener apretado un bloque → levantarlo. beginDrag cierra sobre el render actual; el editor
  // es estable, así que el listener se registra una sola vez por editor.
  useEffect(() => {
    const dom = editor.view.dom
    let timer: ReturnType<typeof setTimeout> | undefined
    let x0 = 0
    let y0 = 0
    const cancel = () => clearTimeout(timer)
    const down = (e: PointerEvent) => {
      x0 = e.clientX
      y0 = e.clientY
      cancel()
      // Mouse: solo click izquierdo limpio. Con modificador es selección (Shift extiende, Mod
      // abre links); sobre el tirador de una imagen es resize.
      const plain =
        e.pointerType === "mouse" && !e.button && !e.shiftKey && !e.metaKey && !e.ctrlKey
      if (!touch && (!plain || (e.target as Element).closest("[data-resize-handle]"))) return
      // Controles dentro del bloque (select de lenguaje, botones): el popover Radix vive en un
      // portal, el pointerup nunca llega a `dom` y el timer dispararía un drag fantasma.
      if ((e.target as Element).closest("button,[role=combobox]")) return
      timer = setTimeout(() => {
        if (!selectBlockAt(editor, x0, y0)) return
        const c = currentBlock(editor)
        if (c) beginDrag(c, y0, (moved) => !moved && onHold?.())
      }, HOLD_MS)
    }
    const move = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - x0, e.clientY - y0) > MOVE_SLOP) cancel()
    }
    // Touch: el menú contextual / lupa nativos compiten con el long-press propio. Con mouse el
    // click derecho es del usuario.
    const ctx = (e: Event) => touch && e.preventDefault()
    dom.addEventListener("pointerdown", down)
    dom.addEventListener("pointermove", move)
    dom.addEventListener("pointerup", cancel)
    dom.addEventListener("pointercancel", cancel)
    dom.addEventListener("contextmenu", ctx)
    return () => {
      cancel()
      dom.removeEventListener("pointerdown", down)
      dom.removeEventListener("pointermove", move)
      dom.removeEventListener("pointerup", cancel)
      dom.removeEventListener("pointercancel", cancel)
      dom.removeEventListener("contextmenu", ctx)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const line = dragging && (
    <div
      ref={lineRef}
      className="pointer-events-none fixed z-50 hidden h-0.5 rounded-dot bg-foreground"
    />
  )
  return { beginDrag, dragging, line }
}

// Desktop: solo el gesto (las acciones viven en el gutter).
export function BlockHoldDrag({ editor }: { editor: Editor }) {
  return useHoldDrag(editor, false).line
}

// Acciones de bloque en touch (prototype block-actions-mobile, variante Combo). En desktop esto
// lo hace el gutter por hover; sin hover no existe, así que acá hay tres puertas a lo mismo:
//  - barra arriba del teclado: +, convertir, duplicar, borrar — mientras el editor tiene foco.
//  - asa ⋮⋮ en el bloque del cursor: tap = sheet con todas las acciones, arrastrar = reordenar.
//  - mantener apretado un bloque: lo levanta para arrastrarlo; soltar sin mover abre el sheet.
export function BlockTouch({ editor }: { editor: Editor }) {
  const [focused, setFocused] = useState(editor.isFocused)
  const [open, setOpen] = useState(false)
  const { beginDrag, dragging, line } = useHoldDrag(editor, true, () => setOpen(true))
  const [handleY, setHandleY] = useState<number | null>(null)

  useEffect(() => {
    const f = () => setFocused(true)
    const b = () => setFocused(false)
    editor.on("focus", f)
    editor.on("blur", b)
    return () => {
      editor.off("focus", f)
      editor.off("blur", b)
    }
  }, [editor])

  // Con el teclado arriba el dock (fixed bottom) estorba: mobile-chrome lo esconde con este atributo.
  useEffect(() => {
    document.body.toggleAttribute("data-editing", focused)
    return () => document.body.removeAttribute("data-editing")
  }, [focused])

  // El asa va centrada en la primera línea del bloque del cursor.
  useEffect(() => {
    const place = () => {
      const c = currentBlock(editor)
      if (!c) return setHandleY(null)
      const r = editor.view.coordsAtPos(c.pos + 1)
      setHandleY((r.top + r.bottom) / 2)
    }
    place()
    editor.on("selectionUpdate", place)
    editor.on("transaction", place)
    const scroller = editor.view.dom.closest("main")
    scroller?.addEventListener("scroll", place, { passive: true })
    return () => {
      editor.off("selectionUpdate", place)
      editor.off("transaction", place)
      scroller?.removeEventListener("scroll", place)
    }
  }, [editor])

  // Asa: tap = sheet; mover >8px = empieza el drag de ese bloque.
  function onHandleDown(e: React.PointerEvent) {
    e.preventDefault()
    const x0 = e.clientX
    const y0 = e.clientY
    const stop = () => {
      document.removeEventListener("pointermove", move)
      document.removeEventListener("pointerup", up)
    }
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < MOVE_SLOP) return
      stop()
      const c = currentBlock(editor)
      if (c) beginDrag(c, ev.clientY, () => {})
    }
    const up = () => {
      stop()
      setOpen(true)
    }
    document.addEventListener("pointermove", move)
    document.addEventListener("pointerup", up)
  }

  return (
    <>
      {focused && <BlockBar editor={editor} />}
      {(focused || open) && handleY !== null && !dragging && (
        <button
          aria-label="Acciones del bloque: tocar para el menú, arrastrar para mover"
          onPointerDown={onHandleDown}
          style={{ top: handleY - 22 }}
          className="fixed right-0 z-30 grid h-11 w-9 touch-none place-items-center rounded-l-xl border border-r-0 bg-popover text-muted-foreground shadow-sm"
        >
          <GripVerticalIcon className="size-5" />
        </button>
      )}
      {line}
      <BlockSheet editor={editor} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
