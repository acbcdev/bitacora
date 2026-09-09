import { useEffect, useRef, useState } from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { ImageOff } from "lucide-react"
import { cn } from "@/core/lib/utils"
import { Skeleton } from "@/core/ui/skeleton"

export function ImageView({ node, selected, updateAttributes }: NodeViewProps) {
  const src = node.attrs.src as string
  const alt = node.attrs.alt as string | null
  const width = node.attrs.width as number | null
  const height = node.attrs.height as number | null
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const startX = useRef(0)
  const startW = useRef(0)
  const side = useRef<"left" | "right" | null>(null)
  const displayWidth = dragWidth ?? width ?? null

  useEffect(() => {
    setLoaded(false)
    setError(false)
  }, [src])

  const hasStoredDimensions = width != null && height != null
  const showLoader = !loaded && !error

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (w && h && !hasStoredDimensions) {
      updateAttributes({ width: width ?? w, height: h })
    }
    setLoaded(true)
  }

  function onMouseDown(s: "left" | "right") {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      side.current = s
      startX.current = e.clientX
      const img = (e.currentTarget as HTMLElement)
        .closest("[data-image-wrapper]")
        ?.querySelector("img")
      const rectW = img?.getBoundingClientRect().width ?? 0
      startW.current = width ?? Math.round(rectW) ?? 320
      setDragWidth(startW.current)
      const prevCursor = document.body.style.cursor
      const prevSelect = document.body.style.userSelect
      const prevHtmlCursor = document.documentElement.style.cursor
      document.body.style.cursor = "ew-resize"
      document.documentElement.style.cursor = "ew-resize"
      document.body.style.userSelect = "none"

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX.current
        let nw = side.current === "right" ? startW.current + delta : startW.current - delta
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

  // CLS: si tenemos width+height reservamos aspect exacto (CLS 0).
  // Si no, skeleton de 220px evita 0->400. Tras el primer onLoad se persiste y next render es 0 CLS.
  const wrapperStyle: React.CSSProperties = {
    width: displayWidth ? `${displayWidth}px` : hasStoredDimensions ? `${width}px` : undefined,
    maxWidth: "100%",
    ...(hasStoredDimensions ? { aspectRatio: `${width}/${height}` } : {}),
  }

  return (
    <NodeViewWrapper className="my-6 flex justify-center">
      <div
        data-image-wrapper
        style={wrapperStyle}
        className={cn(
          "group relative inline-block max-w-full overflow-hidden rounded-lg",
          showLoader && !hasStoredDimensions && "w-full",
        )}
      >
        {/* Loader: solo esqueleto, sin inner div. CLS ya reservado por wrapper. */}
        {showLoader && (
          <Skeleton
            data-testid="image-skeleton"
            // hasStoredDimensions: absolute llena el box reservado por aspect (no CLS)
            // sin dimensiones: bloque 220px visible a ancho completo
            className={cn(
              "rounded-lg border",
              hasStoredDimensions
                ? "absolute inset-0 h-full w-full"
                : "h-[220px] w-full min-h-[220px]",
            )}
          />
        )}

        {error && (
          <div className="flex min-h-45 w-full flex-col items-center justify-center gap-2 rounded-lg border bg-muted p-6 text-muted-foreground">
            <ImageOff className="size-6" />
            <span className="text-sm">{alt || "Imagen no disponible"}</span>
          </div>
        )}

        {/* Imagen: solo se monta visible cuando cargó o cuando tenemos dimensiones para fade.
            Mientras showLoader está activo y NO tenemos aspect, la ocultamos con hidden para
            no duplicar altura (el skeleton ya reserva 220). Con aspect la dejamos absolute
            invisible hasta el onLoad y luego hace fade. */}
        <img
          src={src}
          alt={alt ?? ""}
          width={displayWidth ?? width ?? undefined}
          height={height ?? undefined}
          loading="lazy"
          decoding="async"
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0 && !loaded && !error) {
              queueMicrotask(() =>
                handleLoad({
                  currentTarget: el,
                } as unknown as React.SyntheticEvent<HTMLImageElement>),
              )
            }
          }}
          onLoad={handleLoad}
          onError={() => {
            setError(true)
            setLoaded(true)
          }}
          style={
            displayWidth
              ? {
                  width: `${displayWidth}px`,
                  maxWidth: "100%",
                  aspectRatio: hasStoredDimensions ? `${width}/${height}` : undefined,
                }
              : hasStoredDimensions
                ? { aspectRatio: `${width}/${height}` }
                : undefined
          }
          className={cn(
            "block max-w-full rounded-lg transition-opacity duration-200",
            "cursor-auto! hover:opacity-90",
            selected && "opacity-95",
            showLoader &&
              (hasStoredDimensions ? "absolute inset-0 h-full w-full opacity-0" : "hidden"),
            !showLoader && !error && "opacity-100",
            error && "hidden",
          )}
          draggable={false}
        />

        {/* Handles: visibles siempre (incluso con skeleton) para no romper tests y permitir resize.
            Son absolute, no afectan el layout row. */}
        {!error && (
          <>
            <div
              contentEditable={false}
              data-resize-handle="left"
              onMouseDown={onMouseDown("left")}
              className={cn(
                "absolute top-1/2 left-2 h-12 w-[3px] -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-black/10 dark:bg-zinc-700 dark:ring-white/10",
                "cursor-ew-resize opacity-0 transition-opacity",
                selected
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100",
              )}
              aria-hidden
            />
            <div
              contentEditable={false}
              data-resize-handle="right"
              onMouseDown={onMouseDown("right")}
              className={cn(
                "absolute top-1/2 right-2 h-12 w-[3px] opacity-80 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-black/10 dark:bg-zinc-700 dark:ring-white/10",
                "cursor-ew-resize opacity-0 transition-opacity",
                selected
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100",
              )}
              aria-hidden
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}
