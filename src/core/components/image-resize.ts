// Drag-resize de imagen: listeners de window (mousemove/mouseup) + overlay de cursor.
// Re-escala el height proporcional al nuevo width. Si no hay dims guardadas, nada que escalar.
export function scaledHeight(
  newW: number,
  width: number | null,
  height: number | null,
): number | null {
  if (!width || !height) return null
  return Math.round((newW / width) * height)
}

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
  const max = Math.min(900, window.innerWidth - 64)
  // Clamp inicial: imágenes importadas más anchas que el max saltaban al primer move.
  let lastW = Math.max(120, Math.min(max, startW))
  setDragWidth(startW)
  // Overlay a pantalla completa: el cursor sale del hit-test, no de la cascada. Con
  // body.style.cursor, cualquier elemento con cursor propio (la misma imagen, links,
  // botones) lo pisaba y el cursor parpadeaba a mitad del drag.
  const overlay = document.createElement("div")
  overlay.dataset.resizeOverlay = ""
  // pointer-events:auto explícito: un Dialog modal de Radix (Repaso) pone pointer-events:none
  // en body y el overlay lo heredaba — el mouse lo atravesaba y no hacía nada.
  overlay.style.cssText = "position:fixed;inset:0;z-index:9999;cursor:ew-resize;pointer-events:auto"
  document.body.append(overlay)

  const onMove = (ev: MouseEvent) => {
    // ×2: la imagen está centrada, así que cada px de width mueve el borde medio px.
    // Sin esto el handle se queda atrás del mouse.
    const delta = (ev.clientX - startX) * 2
    let nw = side === "right" ? startW + delta : startW - delta
    nw = Math.max(120, Math.min(max, nw))
    lastW = Math.round(nw)
    setDragWidth(lastW)
  }
  const onUp = () => {
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    overlay.remove()
    commitWidth(lastW)
    // Soltar el override de drag: displayWidth vuelve a salir del atributo width.
    setDragWidth(null)
  }
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
}
