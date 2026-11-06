import { useEffect, useState } from "react"
import type { RefObject } from "react"
import { createPortal } from "react-dom"
import type { Editor } from "@tiptap/react"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { collapseBlockSelection } from "@/core/components/block-selection-keys"

// Marquee (spec block-selection, historias 8–15, 17, 18): mousedown en zona sin texto del
// área de la nota + drag → rectángulo; los bloques top-level que toca quedan en un único
// NodeRangeSelection (halo, drag y bubble salen de la capa de bloques). Siempre reemplaza.

const THRESHOLD = 4
const EDGE = 40 // franja de auto-scroll (historia 16)
const STEP = 12 // px por frame, fijo: sin aceleración

type Rect = { left: number; top: number; right: number; bottom: number }

// Contenedor scrolleable de la nota (main / dialog): delimita dónde arranca el Marquee.
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(p).overflowY)) return p
  }
  return null
}

// Tramo contiguo de bloques top-level que el rect toca → NodeRangeSelection (o nada).
function selectBlocks(editor: Editor, rect: Rect) {
  const { view } = editor
  let from = -1
  let to = -1
  view.state.doc.forEach((node, offset) => {
    const dom = view.nodeDOM(offset)
    if (!(dom instanceof HTMLElement)) return
    const box = dom.getBoundingClientRect()
    if (
      box.bottom < rect.top ||
      box.top > rect.bottom ||
      box.right < rect.left ||
      box.left > rect.right
    )
      return
    if (from < 0) from = offset
    to = offset + node.nodeSize
  })
  const { doc, tr } = view.state
  if (from >= 0) view.dispatch(tr.setSelection(NodeRangeSelection.create(doc, from, to, 0)))
  // El rect ya no toca nada: se va la Selección de bloque (incluida la previa).
  else collapseBlockSelection(view)
}

export function BlockMarquee({
  editor,
  host,
}: {
  editor: Editor
  host: RefObject<HTMLElement | null>
}) {
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    let stopDrag: (() => void) | null = null
    const onDown = (e: MouseEvent) => {
      const hostEl = host.current
      const target = e.target
      if (e.button !== 0 || !hostEl || !(target instanceof Element)) return
      const dom = editor.view.dom
      // Zona del área de la nota: márgenes/padding (ancestros del host: scroller, columna,
      // el hueco bajo el último bloque) o el host mismo. Footer, título, etc. quedan nativos.
      if (!target.contains(hostEl) && !hostEl.contains(target)) return
      // Texto (cualquier cosa dentro del contenteditable salvo su propio padding) y
      // controles (asa, gutters, botones) siguen siendo suyos.
      if (dom.contains(target) && target !== dom) return
      if (
        target.closest(
          "button, a, input, textarea, select, .block-drag-handle, .block-range-gutter",
        )
      )
        return
      const scroller = scrollParent(hostEl)
      if (!(scroller ?? document.body).contains(target)) return
      if (e.clientY < hostEl.getBoundingClientRect().top) return // header / título de la nota
      e.preventDefault() // sin selección nativa de texto durante el drag

      const scrollTop = () => scroller?.scrollTop ?? 0
      // Inicio en coordenadas de contenido (sigue al bloque aunque la nota scrollee); el
      // puntero actual en coordenadas de viewport (client).
      const startX = e.clientX
      const startYContent = e.clientY + scrollTop()
      let pointerX = startX
      let pointerY = e.clientY
      let active = false
      let raf = 0
      const update = () => {
        const startY = startYContent - scrollTop()
        const next = {
          left: Math.min(startX, pointerX),
          top: Math.min(startY, pointerY),
          right: Math.max(startX, pointerX),
          bottom: Math.max(startY, pointerY),
        }
        setRect(next)
        selectBlocks(editor, next)
      }
      // Auto-scroll: a ≤EDGE px del borde del scroller, paso fijo por frame + hit-test.
      const edgeDir = () => {
        if (!scroller) return 0
        const box = scroller.getBoundingClientRect()
        return pointerY <= box.top + EDGE ? -1 : pointerY >= box.bottom - EDGE ? 1 : 0
      }
      const tick = () => {
        raf = 0
        const dir = edgeDir()
        if (!dir || !scroller) return
        scroller.scrollTop += dir * STEP
        update()
        raf = requestAnimationFrame(tick)
      }
      const onMove = (ev: MouseEvent) => {
        if (!active && Math.hypot(ev.clientX - startX, ev.clientY - e.clientY) < THRESHOLD) return
        if (!active) editor.view.focus()
        active = true
        pointerX = ev.clientX
        pointerY = ev.clientY
        update()
        if (!raf && edgeDir()) raf = requestAnimationFrame(tick)
      }
      const onUp = () => {
        stopDrag?.()
        setRect(null)
        if (!active) return
        // El click que sigue al drag no debe colapsar la selección (focusEnd de note-body).
        const stop = (ce: Event) => ce.stopPropagation()
        window.addEventListener("click", stop, { capture: true, once: true })
        setTimeout(() => window.removeEventListener("click", stop, { capture: true }))
      }
      stopDrag = () => {
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
        cancelAnimationFrame(raf)
        stopDrag = null
      }
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
    }
    document.addEventListener("mousedown", onDown)
    return () => {
      document.removeEventListener("mousedown", onDown)
      stopDrag?.() // desmonte en pleno drag: nada toca un editor destruido
    }
  }, [editor, host])

  if (!rect) return null
  // Portal: el dialog de nota tiene transform, que rompería el position: fixed.
  return createPortal(
    <div
      data-testid="block-marquee"
      className="pointer-events-none fixed z-50 border border-border bg-foreground/5"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
      }}
    />,
    document.body,
  )
}
