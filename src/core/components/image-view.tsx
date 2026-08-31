import { useRef, useState } from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { cn } from "@/core/lib/utils"

export function ImageView({ node, selected, updateAttributes }: NodeViewProps) {
  const src = node.attrs.src as string
  const alt = node.attrs.alt as string | null
  const width = node.attrs.width as number | null
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const startX = useRef(0)
  const startW = useRef(0)
  const side = useRef<"left" | "right" | null>(null)
  // Ancho mostrado: durante drag usa dragWidth, si no el guardado, si no null (auto)
  const displayWidth = dragWidth ?? width ?? null

  function onMouseDown(s: "left" | "right") {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      side.current = s
      startX.current = e.clientX
      // Si no hay width guardado, usar el ancho actual del img
      const img = (e.currentTarget as HTMLElement)
        .closest("[data-image-wrapper]")
        ?.querySelector("img")
      const rectW = img?.getBoundingClientRect().width ?? 0
      startW.current = width ?? Math.round(rectW) ?? 320
      setDragWidth(startW.current)
      // Feedback de cursor mientras se arrastra: ew-resize global + evitar selección
      const prevCursor = document.body.style.cursor
      const prevSelect = document.body.style.userSelect
      const prevHtmlCursor = document.documentElement.style.cursor
      document.body.style.cursor = "ew-resize"
      document.documentElement.style.cursor = "ew-resize"
      document.body.style.userSelect = "none"

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX.current
        let nw = side.current === "right" ? startW.current + delta : startW.current - delta
        // clamp: mínimo 120, máximo 900 o ancho del contenedor - 32
        const max = Math.min(900, window.innerWidth - 64)
        nw = Math.max(120, Math.min(max, nw))
        setDragWidth(Math.round(nw))
      }
      const onUp = () => {
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
        document.body.style.cursor = prevCursor
        document.documentElement.style.cursor = prevHtmlCursor
        document.body.style.userSelect = prevSelect
        // commit si hubo drag
        setDragWidth((cur) => {
          if (cur != null) updateAttributes({ width: cur })
          return null
        })
        side.current = null
      }
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    }
  }

  return (
    <NodeViewWrapper
      className="my-6 flex justify-center"
      // ProseMirror ignora clicks con contentEditable false en handles
    >
      <div
        data-image-wrapper
        className="group relative inline-block max-w-full"
        // Para que el click en la imagen siga burbujeando al host (lightbox) no lo bloqueamos
      >
        <img
          src={src}
          alt={alt ?? ""}
          width={displayWidth ?? undefined}
          style={displayWidth ? { width: `${displayWidth}px`, maxWidth: "100%" } : undefined}
          className={cn(
            "block max-w-full rounded-lg transition-opacity",
            "cursor-zoom-in hover:opacity-90",
            selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
          )}
          draggable={false}
        />
        {/* Handles dentro del borde (8px inset) para no perder group-hover al mover a la barra.
            Hit-area exacta de 3px + cursor solo en la barra evita sticky ew-resize sobre la imagen. */}
        <div
          contentEditable={false}
          data-resize-handle="left"
          onMouseDown={onMouseDown("left")}
          className={cn(
            "absolute top-1/2 left-2 flex -translate-y-1/2 items-center justify-center",
            "opacity-0 transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none",
            selected && "opacity-100 pointer-events-auto",
          )}
          aria-hidden
        >
          <div className="h-12 w-[3px] cursor-ew-resize rounded-full bg-white shadow-md ring-1 ring-black/10 dark:bg-zinc-700 dark:ring-white/10" />
        </div>
        <div
          contentEditable={false}
          data-resize-handle="right"
          onMouseDown={onMouseDown("right")}
          className={cn(
            "absolute top-1/2 right-2 flex -translate-y-1/2 items-center justify-center",
            "opacity-0 transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none",
            selected && "opacity-100 pointer-events-auto",
          )}
          aria-hidden
        >
          <div className="h-12 w-[3px] cursor-ew-resize rounded-full bg-white shadow-md ring-1 ring-black/10 dark:bg-zinc-700 dark:ring-white/10" />
        </div>
      </div>
    </NodeViewWrapper>
  )
}
