import { useCallback, useState } from "react"
import { Maximize2, Pause, Play } from "lucide-react"
import { Button } from "@/core/ui/button"
import { cn } from "@/core/lib/utils"
import { deriveHabit } from "@/habits/habits"
import { useHabitLog, useHabits } from "@/habits/habits.api"
import { HabitZoom } from "@/habits/habit-zoom"
import { formatClock } from "@/habits/habit-timer"
import { useHabitTimer } from "@/habits/use-habit-timer"

// Cronómetro a mano en el sidebar: una pill con play/pausa como acción primaria; tocar cualquier
// otro lado abre el timer a pantalla completa (HabitZoom). Corriendo muestra ese hábito; sin
// cronómetro, el primer `time` pendiente. Si todos están cumplidos, no se muestra. Sin hover:
// funciona igual en touch.
// El sidebar lo monta sólo fuera de Hoy: ahí la tira ya tiene su useHabitTimer, y dos instancias
// vivas auto-finalizarían el cronómetro dos veces.
export function MiniTimer() {
  const { data: habits = [] } = useHabits()
  const { data: log = [] } = useHabitLog()
  const { runningId, shown, clock, toggle } = useHabitTimer(habits, log)
  const [zoom, setZoom] = useState(false)
  // Estable: HabitZoom lo tiene de dep y la pill repinta cada segundo con el timer.
  const closeZoom = useCallback(() => setZoom(false), [])

  const timeHabits = habits.filter((x) => x.metric === "time")
  const h =
    habits.find((x) => x.id === runningId) ?? timeHabits.find((x) => !deriveHabit(x, log).met)
  if (!h) return null

  const state = deriveHabit(h, log)
  const running = h.id === runningId
  const total = running ? shown : state.total
  const pct = Math.min(100, (total / Math.max(h.target, 1)) * 100)
  const time = running && clock ? clock : formatClock(total)
  const paused = !running && total > 0 && !state.met

  return (
    <>
      <div className="hatch group relative isolate flex h-11 items-center gap-2 overflow-hidden rounded-full bg-card pl-1.5 shadow-card">
        {/* Mismo bloque que el tile: habit-block, 60% al pausar, borde recto (lo recorta el
            overflow-hidden). -z-10 + isolate: sobre el fondo y bajo el contenido. */}
        <span
          aria-hidden
          style={{ width: `${pct}%` }}
          className={cn(
            "absolute inset-y-0 left-0 -z-10 bg-habit-block transition-[width] duration-1000 ease-linear",
            !running && "opacity-60",
          )}
        />
        <Button
          type="button"
          onClick={() => toggle(h)}
          aria-label={running ? `Pausar ${h.name}` : `Reanudar ${h.name}`}
          className="size-8 p-0"
        >
          {running ? (
            <Pause className="size-3.5" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play className="size-3.5" fill="currentColor" strokeWidth={0} />
          )}
        </Button>
        {/* Todo el resto de la pill es el botón de ampliar, padding derecho incluido. */}
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label={`Ampliar ${h.name}`}
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 pr-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="min-w-0 flex-1 truncate text-sm">{h.name}</span>
          <Maximize2
            aria-hidden
            className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 ease-out group-focus-within:opacity-100 group-hover:opacity-100"
          />
          <span className={cn("font-mono text-sm tabular-nums", running && "text-signal")}>
            {time}
          </span>
        </button>
      </div>

      {zoom && (
        <HabitZoom
          h={h}
          total={total}
          r={{ running, clock: running ? clock : paused ? formatClock(total) : null, paused }}
          block={pct}
          onQuick={() => toggle(h)}
          onClose={closeZoom}
        />
      )}
    </>
  )
}
