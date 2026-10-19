import { useEffect, type MouseEvent } from "react"
import { Dialog } from "radix-ui"
import { Pause, Play } from "lucide-react"
import { displayAmount, displayTarget } from "@/habits/habits"
import { cn } from "@/core/lib/utils"
import type { Run } from "@/habits/habit-tile-info"
import type { Habit } from "@/core/types/database"

// Modo ampliado del cronómetro: el tile llevado a pantalla completa, tipo protector de pantalla.
// Mismo lenguaje (ADR 0023): card + hatch y el bloque que sube con el progreso; nombre arriba a la
// izquierda y pausa arriba a la derecha, como en el tile. El número también pausa/reanuda; tocar
// el fondo (o Esc) cierra.
export function HabitZoom({
  h,
  total,
  r,
  block,
  onQuick,
  onClose,
}: {
  h: Habit
  total: number
  r: Run
  block: number
  onQuick: () => void
  onClose: () => void
}) {
  // Fullscreen nativo + wake lock, mejor-effort (mismo criterio que use-focus-mode): el effect
  // corre dentro de la activación del click que abrió. iPhone no tiene requestFullscreen sobre
  // elementos — queda el overlay fixed. Esc del browser sale del fullscreen → cerramos.
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    let lock: WakeLockSentinel | undefined
    navigator.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {})

    let wasFull = false
    function sync() {
      if (document.fullscreenElement) wasFull = true
      else if (wasFull) onClose()
    }
    document.addEventListener("fullscreenchange", sync)
    return () => {
      document.removeEventListener("fullscreenchange", sync)
      if (document.fullscreenElement) void document.exitFullscreen()
      void lock?.release()
    }
  }, [onClose])

  const toggle = (e: MouseEvent) => {
    e.stopPropagation()
    onQuick()
  }

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onClick={onClose}
          className="hatch fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-card outline-none"
        >
          <span
            aria-hidden
            style={{ height: `${block}%` }}
            className={cn(
              "absolute inset-x-0 bottom-0 bg-habit-block transition-[height] duration-1000 ease-linear",
              r.paused && "opacity-60",
            )}
          />

          <Dialog.Title className="absolute top-8 left-8 flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <i
              aria-hidden
              className={cn(
                "size-2 rounded-full",
                r.running ? "animate-pulse bg-signal" : "bg-current",
              )}
            />
            {h.name}
          </Dialog.Title>

          <button
            type="button"
            onClick={toggle}
            aria-label={r.running ? `Pausar ${h.name}` : `Reanudar ${h.name}`}
            className="absolute top-6 right-6 flex size-12 items-center justify-center rounded-full bg-foreground text-background"
          >
            {r.running ? (
              <Pause size={18} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={18} fill="currentColor" strokeWidth={0} />
            )}
          </button>

          {/* Mouse-only, igual que el hero del tile: teclado usa el botón de arriba. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={toggle}
            className="relative flex items-baseline text-[min(24vw,42vh)] leading-none font-normal tracking-tighter tabular-nums dark:font-light"
          >
            {r.clock ?? displayAmount(h, total)}
            <small className="ml-[0.15em] text-[0.12em] font-normal tracking-normal text-muted-foreground">
              /{displayTarget(h)} min
            </small>
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
