import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { Dialog as DialogPrimitive } from "radix-ui" // misma primitive que shadcn/ui Dialog; se usa directo para fullscreen sin card/ring de DialogContent
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ImageOff,
  Maximize,
  Minus,
  Plus,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { copyImage, downloadImage, type LightboxImage } from "./editor-lightbox-utils"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/core/ui/tooltip"

export type { LightboxImage }

const MAX_FIT = 2 // el fit agranda hasta 2× el tamaño natural, no más (no pixelar)
const ZOOM_STEP = 0.25
const MIN_ZOOM = 0.25
const MAX_ZOOM = 8

function ToolButton({
  label,
  kbd,
  onClick,
  children,
}: {
  label: string
  kbd?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {kbd && <Kbd>{kbd}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
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
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)
  // Zoom y tamaño natural viven atados al src: al cambiar de imagen `view` deja de coincidir y
  // se lee el default (fit) sin effect de reset. Cerrar lo limpia explícito.
  const [view, setView] = useState<{
    src: string
    zoom: number | null
    nat: { w: number; h: number } | null
  } | null>(null)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const touchStartX = useRef<number | null>(null)
  const drag = useRef<{ x: number; y: number; l: number; t: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  // Roto es por-src, no un booleano que se resetea con un effect: al cambiar de imagen, la
  // pregunta es si ESTA imagen falló. El <img> ya se remonta por key={src}.
  // ponytail: una imagen rota no reintenta al reabrirse salvo que el src cambie.
  const current = images[index]
  const broken = brokenSrc != null && brokenSrc === current?.src
  const count = images.length
  const v = view?.src === current?.src ? view : null
  const zoom = v?.zoom ?? null
  const nat = v?.nat ?? null
  // ponytail: el fit se calcula en render con el viewport actual; no re-calcula al redimensionar
  // la ventana hasta el próximo render.
  const fitScale = nat
    ? Math.min((window.innerWidth * 0.9) / nat.w, (window.innerHeight * 0.75) / nat.h, MAX_FIT)
    : 1
  const scale = zoom ?? fitScale

  const patch = (p: { zoom?: number | null; nat?: { w: number; h: number } | null }) =>
    setView({ src: current.src, zoom, nat, ...p })
  const setZoom = (z: number | null) =>
    patch({ zoom: z == null ? null : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)) })

  const zoomBy = (step: number) => setZoom(scale + step)
  const toggleZoom = () => setZoom(zoom == null ? 1 : null)

  const handleOpenChange = (o: boolean) => {
    if (!o) setView(null)
    onOpenChange(o)
  }

  const download = () =>
    downloadImage(current.src, current.alt).catch(() =>
      toast.error("No se pudo descargar la imagen"),
    )
  const copy = () =>
    copyImage(current.src)
      .then(() => toast.success("Imagen copiada"))
      .catch(() => toast.error("No se pudo copiar la imagen"))

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
      handleOpenChange(false)
      return
    }
    // Atajos sin modificadores (cmd/ctrl+C queda para copiar texto del alt) y fuera de inputs.
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]"))
      return
    if (/^[1-9]$/.test(e.key)) {
      // 9 = última (como ctrl+9 en tabs), no la imagen número 9.
      const n = e.key === "9" ? count : Number(e.key)
      if (n <= count) onIndexChange(n - 1)
      return
    }
    const actions: Record<string, () => void> = {
      z: toggleZoom,
      "+": () => zoomBy(ZOOM_STEP),
      "=": () => zoomBy(ZOOM_STEP),
      "-": () => zoomBy(-ZOOM_STEP),
      "0": () => setZoom(null),
      d: download,
      c: copy,
    }
    const action = actions[e.key.toLowerCase()]
    if (action) {
      e.preventDefault()
      action()
    }
  })
  const onWheel = useEffectEvent((e: WheelEvent) => {
    // ctrl+wheel y pinch de trackpad (llega como wheel+ctrlKey) = zoom; wheel normal = scroll nativo.
    if (!e.ctrlKey) return
    e.preventDefault()
    setZoom(scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
  })
  useEffect(() => {
    if (!viewport) return
    viewport.addEventListener("wheel", onWheel, { passive: false })
    return () => viewport.removeEventListener("wheel", onWheel)
  }, [viewport])
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
    if (zoom != null) return // con zoom el gesto horizontal es pan, no navegación
    if (start == null || end == null) return
    const delta = end - start
    if (Math.abs(delta) < 40) return
    if (delta < 0) goNext()
    else goPrev()
  }

  if (!current) return null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="lightbox-overlay"
          onClick={() => handleOpenChange(false)}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Content
          data-slot="lightbox-content"
          aria-describedby={undefined}
          // El lightbox es fullscreen encima del editor: sin card, sin ring. El click en el
          // backdrop (overlay) cierra vía Radix; el click directo sobre el Content (área
          // alrededor de la imagen cuando no hay overlay) también cierra para cumplir US 9.
          onClick={(e) => {
            if (e.target === e.currentTarget) handleOpenChange(false)
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          // animation-duration y no duration-*: duration-* también setea transition-duration,
          // y con el transition-property default (all) eso anima cualquier propiedad que cambie.
          // Mobile: sin padding para que la imagen use todo el ancho; sm restaura el marco.
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-transparent p-0 outline-none animation-duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 sm:p-4"
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
              size="icon-sm"
              aria-label="Cerrar"
              className="absolute top-4 right-4 bg-muted/80 backdrop-blur hover:bg-muted"
            >
              <XIcon />
            </Button>
          </DialogPrimitive.Close>

          {/* Imagen */}
          <div className="flex max-h-[90vh] w-full flex-col items-center justify-center gap-3 sm:w-auto">
            {broken ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted p-8 text-muted-foreground">
                <ImageOff className="size-10" />
                <span className="text-sm">{current.alt || "Imagen no disponible"}</span>
              </div>
            ) : (
              // overflow-auto = pan nativo (scroll/arrastre) cuando el zoom desborda el viewport
              <div
                ref={setViewport}
                data-slot="lightbox-viewport"
                className="max-h-[80vh] max-w-full overflow-auto rounded-lg shadow-xl sm:max-w-[90vw]"
                onPointerDown={(e) => {
                  dragged.current = false
                  const el = e.currentTarget
                  drag.current = {
                    x: e.clientX,
                    y: e.clientY,
                    l: el.scrollLeft,
                    t: el.scrollTop,
                    moved: false,
                  }
                }}
                onPointerMove={(e) => {
                  const d = drag.current
                  if (!d) return
                  const dx = e.clientX - d.x
                  const dy = e.clientY - d.y
                  if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
                  e.currentTarget.scrollLeft = d.l - dx
                  e.currentTarget.scrollTop = d.t - dy
                }}
                onPointerUp={() => {
                  dragged.current = drag.current?.moved ?? false
                  drag.current = null
                }}
              >
                {/* key forces remount on src change so onError resets correctly */}
                <img
                  key={current.src}
                  src={current.src}
                  alt={current.alt ?? ""}
                  onError={() => setBrokenSrc(current.src)}
                  onLoad={(e) => {
                    const { naturalWidth: w, naturalHeight: h } = e.currentTarget
                    if (w && h) patch({ nat: { w, h } })
                  }}
                  onClick={() => {
                    if (dragged.current) dragged.current = false
                    else toggleZoom()
                  }}
                  style={nat ? { width: nat.w * scale } : undefined}
                  // Sin nat (aún cargando) cae al tope CSS; con nat el ancho es explícito.
                  className={
                    nat
                      ? `h-auto max-w-none ${zoom == null ? "cursor-zoom-in" : "cursor-zoom-out"}`
                      : "h-auto max-h-[90vh] w-full max-w-full object-contain sm:w-auto sm:max-w-[90vw]"
                  }
                />
              </div>
            )}
            {current.alt && !broken && (
              <p className="max-w-full text-center text-sm text-fg-secondary sm:max-w-[90vw]">
                {current.alt}
              </p>
            )}
          </div>

          {/* Toolbar */}
          {!broken && (
            <TooltipProvider>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-muted/80 p-1 backdrop-blur">
                <ToolButton label="Alejar" kbd="-" onClick={() => zoomBy(-ZOOM_STEP)}>
                  <Minus />
                </ToolButton>
                <span className="mono-dim w-12 text-center text-xs">
                  {Math.round(scale * 100)}%
                </span>
                <ToolButton label="Acercar" kbd="+" onClick={() => zoomBy(ZOOM_STEP)}>
                  <Plus />
                </ToolButton>
                <ToolButton label="Ajustar" kbd="0" onClick={() => setZoom(null)}>
                  <Maximize />
                </ToolButton>
                <span className="mx-1 h-4 w-px bg-border" />
                <ToolButton label="Descargar" kbd="D" onClick={download}>
                  <Download />
                </ToolButton>
                <ToolButton label="Copiar" kbd="C" onClick={copy}>
                  <Copy />
                </ToolButton>
              </div>
            </TooltipProvider>
          )}

          {/* Navegación: en mobile se navega con swipe, los chevrons se esconden. */}
          {count > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Imagen anterior"
                onClick={goPrev}
                className="absolute top-1/2 left-4 hidden -translate-y-1/2 bg-muted/80 backdrop-blur hover:bg-muted sm:inline-flex"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Imagen siguiente"
                onClick={goNext}
                className="absolute top-1/2 right-4 hidden -translate-y-1/2 bg-muted/80 backdrop-blur hover:bg-muted sm:inline-flex"
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
