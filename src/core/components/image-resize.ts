// Drag-resize de imagen: listeners de window (mousemove/mouseup) + restauración de
// cursor/userSelect. Cortado de image-view.tsx tal cual.
export function startImageResize(
  e: React.MouseEvent,
  startW: number,
  side: "left" | "right",
  setDragWidth: (w: number | null) => void,
  commitWidth: (w: number) => void,
) {
  e.preventDefault()
  e.stopPropagation()
  const startX = e.clientX
  let lastW = startW
  setDragWidth(startW)
  const prevCursor = document.body.style.cursor
  const prevSelect = document.body.style.userSelect
  const prevHtmlCursor = document.documentElement.style.cursor
  document.body.style.cursor = "ew-resize"
  document.documentElement.style.cursor = "ew-resize"
  document.body.style.userSelect = "none"

  const onMove = (ev: MouseEvent) => {
    const delta = ev.clientX - startX
    let nw = side === "right" ? startW + delta : startW - delta
    const max = Math.min(900, window.innerWidth - 64)
    nw = Math.max(120, Math.min(max, nw))
    lastW = Math.round(nw)
    setDragWidth(lastW)
  }
  const onUp = () => {
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    document.body.style.cursor = prevCursor
    document.documentElement.style.cursor = prevHtmlCursor
    document.body.style.userSelect = prevSelect
    commitWidth(lastW)
    // Soltar el override de drag: displayWidth vuelve a salir del atributo width.
    setDragWidth(null)
  }
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
}
