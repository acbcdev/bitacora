import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { Dialog as DialogPrimitive } from "radix-ui" // misma primitive que shadcn/ui Dialog; se usa directo para fullscreen sin card/ring de DialogContent
import { ChevronLeft, ChevronRight, ImageOff, XIcon } from "lucide-react"
import type { LightboxImage } from "./editor-lightbox-utils"
import { Button } from "@/core/ui/button"

export type { LightboxImage }

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
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)
  const touchStartX = useRef<number | null>(null)
  // Roto es por-src, no un booleano que se resetea con un effect: al cambiar de imagen, la
  // pregunta es si ESTA imagen falló. El <img> ya se remonta por key={src}.
  // ponytail: una imagen rota no reintenta al reabrirse salvo que el src cambie.
  const current = images[index]
  const broken = brokenSrc != null && brokenSrc === current?.src
  const count = images.length

  const goPrev = useCallback(() => {
    if (count <= 1) return
    onIndexChange((index - 1 + count) % count)
  }, [count, index, onIndexChange])

  const goNext = useCallback(() => {
    if (count <= 1) return
    onIndexChange((index + 1) % count)
  }, [count, index, onIndexChange])

  // useEffectEvent: la suscripción depende solo de `open` — goPrev/goNext/onOpenChange se leen
  // con los valores frescos en cada evento, sin re-subscribir por cada flecha.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
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
  })
  useEffect(() => {
    if (!open) return
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const onTouchStart = (e: React.TouchEvent) => {
    // SAFETY: React.TouchEvent ya tipa touches/changedTouches (TouchList de DOM); clientX sale
    // del primer touch que exista y puede venir undefined en mocks de test.
    const x = e.touches[0] ?? e.changedTouches[0] ?? null
    touchStartX.current = x?.clientX ?? null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current
    const end = (e.changedTouches[0] ?? e.touches[0] ?? null)?.clientX
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
          // animation-duration y no duration-*: duration-* también setea transition-duration,
          // y con el transition-property default (all) eso anima cualquier propiedad que cambie.
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-transparent p-4 outline-none animation-duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
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
                onError={() => setBrokenSrc(current.src)}
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
