import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog as DialogPrimitive } from "radix-ui" // misma primitive que shadcn/ui Dialog; se usa directo para fullscreen sin card/ring de DialogContent
import { ChevronLeft, ChevronRight, ImageOff, XIcon } from "lucide-react"
import type { TiptapDoc } from "@/core/types/database"
import { Button } from "@/core/ui/button"

export type LightboxImage = { src: string; alt?: string }

export function collectImages(doc: TiptapDoc): LightboxImage[] {
  const out: LightboxImage[] = []
  const walk = (nodes: unknown[]) => {
    for (const n of nodes) {
      if (!n || typeof n !== "object") continue
      const node = n as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }
      if (node.type === "image" && typeof node.attrs?.src === "string") {
        out.push({
          src: node.attrs.src,
          alt: typeof node.attrs.alt === "string" ? node.attrs.alt : undefined,
        })
      }
      if (Array.isArray(node.content)) walk(node.content)
    }
  }
  walk((doc.content as unknown[]) ?? [])
  return out
}

export function EditorLightbox({
  images,
  index,
  open,
  onOpenChange,
  onIndexChange,
}: {
  images: LightboxImage[]
  index: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onIndexChange: (next: number) => void
}) {
  const [broken, setBroken] = useState(false)
  const touchStartX = useRef<number | null>(null)

  // Reset broken when image changes
  useEffect(() => {
    setBroken(false)
  }, [index, images])

  const current = images[index]
  const count = images.length

  const goPrev = useCallback(() => {
    if (count <= 1) return
    onIndexChange((index - 1 + count) % count)
  }, [count, index, onIndexChange])

  const goNext = useCallback(() => {
    if (count <= 1) return
    onIndexChange((index + 1) % count)
  }, [count, index, onIndexChange])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        goNext()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, goPrev, goNext, onOpenChange])

  const onTouchStart = (e: React.TouchEvent) => {
    const x = (e.touches?.[0] ??
      (e as unknown as { changedTouches?: TouchList })?.changedTouches?.[0] ??
      null) as unknown as { clientX?: number } | null
    touchStartX.current = x?.clientX ?? null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current
    const endTouch = (e.changedTouches?.[0] ?? e.touches?.[0] ?? null) as unknown as {
      clientX?: number
    } | null
    const end = endTouch?.clientX
    touchStartX.current = null
    if (start == null || end == null) return
    const delta = end - start
    if (Math.abs(delta) < 40) return
    if (delta < 0) goNext()
    else goPrev()
  }

  if (!current) return null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="lightbox-overlay"
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Content
          data-slot="lightbox-content"
          aria-describedby={undefined}
          // El lightbox es fullscreen encima del editor: sin card, sin ring. El click en el
          // backdrop (overlay) cierra vía Radix; el click directo sobre el Content (área
          // alrededor de la imagen cuando no hay overlay) también cierra para cumplir US 9.
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false)
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-transparent p-4 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        >
          <DialogPrimitive.Title className="sr-only">Imagen ampliada</DialogPrimitive.Title>
          {/* Índice */}
          {count > 1 && (
            <span className="mono-dim absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-muted/80 px-2 py-1 text-xs backdrop-blur">
              {index + 1} / {count}
            </span>
          )}
          {/* Botón cerrar (Radix Close) */}
          <DialogPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar"
              className="absolute top-4 right-4 bg-muted/80 backdrop-blur hover:bg-muted"
            >
              <XIcon />
            </Button>
          </DialogPrimitive.Close>

          {/* Imagen */}
          <div className="flex max-h-[90vh] max-w-[90vw] flex-col items-center justify-center gap-3">
            {broken ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted p-8 text-muted-foreground">
                <ImageOff className="size-10" />
                <span className="text-sm">{current.alt || "Imagen no disponible"}</span>
              </div>
            ) : (
              // key forces remount on src change so onError resets correctly
              <img
                key={current.src}
                src={current.src}
                alt={current.alt ?? ""}
                onError={() => setBroken(true)}
                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-xl"
              />
            )}
            {current.alt && !broken && (
              <p className="max-w-[90vw] text-center text-sm text-fg-secondary">{current.alt}</p>
            )}
          </div>

          {/* Navegación */}
          {count > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Imagen anterior"
                onClick={goPrev}
                className="absolute top-1/2 left-2 -translate-y-1/2 bg-muted/80 backdrop-blur hover:bg-muted sm:left-4"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Imagen siguiente"
                onClick={goNext}
                className="absolute top-1/2 right-2 -translate-y-1/2 bg-muted/80 backdrop-blur hover:bg-muted sm:right-4"
              >
                <ChevronRight />
              </Button>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
