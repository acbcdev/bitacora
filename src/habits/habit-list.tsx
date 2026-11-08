import { useCallback, useState } from "react"
import { Check, Circle, Flame, Target } from "lucide-react"
import { cn } from "@/core/lib/utils"
import { HabitDots } from "@/habits/habit-dots"
import { HabitTileActions } from "@/habits/habit-tile-actions"
import { quickLabel, tileTone, type Run } from "@/habits/habit-tile-info"
import { HabitZoom } from "@/habits/habit-zoom"
import { formatClock } from "@/habits/habit-timer"
import {
  displayAmount,
  displayTarget,
  goalText,
  meets,
  streakText,
  type HabitState,
} from "@/habits/habits"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import type { Habit } from "@/core/types/database"

const TONE = { over: "text-destructive", done: "text-signal", off: "text-muted-foreground" }

// Vista lista: el tile comprimido a una fila. Mismo idioma (ADR 0023) girado: hatch = lo que
// falta, bloque horizontal = progreso; el número grande sigue mandando, a la derecha.
// Mismas props y misma derivación que HabitTile — sólo cambia el layout.
export function HabitListRow({
  e: { h, state },
  total,
  running,
  clock,
  pending,
  onQuick,
}: {
  e: { h: Habit; state: HabitState }
  total: number
  running: boolean
  clock: string | null
  pending: boolean
  onQuick: () => void
}) {
  const met = meets(h.kind, total, h.target)
  const tone = tileTone(h, total, met)
  const pct = Math.min(100, (total / Math.max(h.target, 1)) * 100)
  const block = tone === "over" ? 0 : tone === "done" ? 100 : pct
  const paused = h.metric === "time" && !running && total > 0 && !met
  const r: Run = { running, clock: clock ?? (paused ? formatClock(total) : null), paused }
  const [zoom, setZoom] = useState(false)
  const closeZoom = useCallback(() => setZoom(false), [])

  return (
    <div className="group hatch relative flex h-[72px] items-center gap-3 overflow-hidden rounded-xl bg-card pr-3 pl-3.5 shadow-card">
      <span
        aria-hidden
        style={{ width: `${block}%` }}
        className={cn(
          "absolute inset-y-0 left-0 bg-habit-block transition-[width] duration-300 ease-out",
          paused && "opacity-60",
        )}
      />
      {/* Fila entera = acción rápida, mouse-only (mismo stretched button que HabitTile). */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onQuick}
        className="absolute inset-0 cursor-pointer"
      />

      <span
        className={cn(
          "pointer-events-none relative flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-fg-secondary",
          running && "text-signal",
        )}
      >
        <NotebookIcon icon={h.icon} fallback={Target} className="size-4" />
      </span>

      <span className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[14px] font-medium">{h.name}</span>
        <span className="flex items-center gap-3 font-mono text-[11px] leading-none text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{goalText(h)}</span>
            {state.streak >= 2 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Flame size={10} />
                {streakText(h, state.streak)}
              </span>
            )}
          </span>
          <HabitDots h={h} dots={state.days.slice(-7)} />
        </span>
      </span>

      <span
        className={cn(
          "pointer-events-none relative flex items-baseline text-[28px] leading-none font-normal tracking-tighter tabular-nums dark:font-light",
          TONE[tone as keyof typeof TONE],
        )}
      >
        {r.running ? (
          r.clock
        ) : h.metric === "check" ? (
          total > 0 ? (
            <Check className="size-6" strokeWidth={2.25} />
          ) : (
            <Circle className="size-6" strokeWidth={1.5} strokeDasharray="3 3" />
          )
        ) : (
          <>
            {displayAmount(h, total)}
            <small className="ml-0.5 text-xs font-normal tracking-normal text-muted-foreground">
              /{displayTarget(h)}
            </small>
          </>
        )}
      </span>

      <HabitTileActions
        h={h}
        state={state}
        total={total}
        running={running}
        isActive={running}
        pending={pending}
        quickLabel={quickLabel(h, r)}
        onQuick={onQuick}
        onZoom={() => setZoom(true)}
      />

      {zoom && (
        <HabitZoom h={h} total={total} r={r} block={block} onQuick={onQuick} onClose={closeZoom} />
      )}
    </div>
  )
}
