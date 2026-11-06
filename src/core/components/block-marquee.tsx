import { useEffect, useState } from "react"
import type { RefObject } from "react"
import { createPortal } from "react-dom"
import type { Editor } from "@tiptap/react"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { TextSelection } from "@tiptap/pm/state"

// Marquee (spec block-selection, historias 8–15, 17, 18): mousedown en zona sin texto del
// área de la nota + drag → rectángulo; los bloques top-level que toca quedan en un único
// NodeRangeSelection (halo, drag y bubble salen de la capa de bloques). Siempre reemplaza.

const THRESHOLD = 4

type Rect = { left: number; top: number; right: number; bottom: number }

// Contenedor scrolleable de la nota (main / dialog): delimita dónde arranca el Marquee.
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(p).overflowY)) return p
  }
  return null
}

// Tramo contiguo de bloques top-level que el rect toca → NodeRangeSelection (o nada).
function selectBlocks(editor: Editor, r: Rect) {
  const { view } = editor
  let from = -1
  let to = -1
  view.state.doc.forEach((node, offset) => {
    const dom = view.nodeDOM(offset)
    if (!(dom instanceof HTMLElement)) return
    const b = dom.getBoundingClientRect()
    if (b.bottom < r.top || b.top > r.bottom || b.right < r.left || b.left > r.right) return
    if (from < 0) from = offset
    to = offset + node.nodeSize
  })
  const { doc, selection, tr } = view.state
  if (from >= 0) view.dispatch(tr.setSelection(NodeRangeSelection.create(doc, from, to, 0)))
  // El rect ya no toca nada: se va la Selección de bloque (incluida la previa).
  else if (selection instanceof NodeRangeSelection)
    view.dispatch(tr.setSelection(TextSelection.near(doc.resolve(selection.from))))
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
    const onDown = (e: MouseEvent) => {
      const h = host.current
      const t = e.target
      if (e.button !== 0 || !h || !(t instanceof Element)) return
      const dom = editor.view.dom
      // Texto (cualquier cosa dentro del contenteditable salvo su propio padding) y
      // controles (asa, gutters, botones) siguen siendo suyos.
      if (dom.contains(t) && t !== dom) return
      if (t.closest("button, a, input, textarea, select, .block-drag-handle, .block-range-gutter"))
        return
      if (!(scrollParent(h) ?? document.body).contains(t)) return
      if (e.clientY < h.getBoundingClientRect().top) return // header / título de la nota
      e.preventDefault() // sin selección nativa de texto durante el drag

      const x0 = e.clientX
      const y0 = e.clientY
      let active = false
      const onMove = (ev: MouseEvent) => {
        if (!active && Math.hypot(ev.clientX - x0, ev.clientY - y0) < THRESHOLD) return
        if (!active) editor.view.focus()
        active = true
        const r = {
          left: Math.min(x0, ev.clientX),
          top: Math.min(y0, ev.clientY),
          right: Math.max(x0, ev.clientX),
          bottom: Math.max(y0, ev.clientY),
        }
        setRect(r)
        selectBlocks(editor, r)
      }
      const onUp = () => {
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
        setRect(null)
        if (!active) return
        // El click que sigue al drag no debe colapsar la selección (focusEnd de note-body).
        const stop = (ce: Event) => ce.stopPropagation()
        window.addEventListener("click", stop, { capture: true, once: true })
        setTimeout(() => window.removeEventListener("click", stop, { capture: true }))
      }
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
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
