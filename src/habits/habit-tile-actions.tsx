import { Check, Pause, Play, Plus } from "lucide-react"
import { Button } from "@/core/ui/button"
import { HabitPanel } from "@/habits/habit-panel"
import { cn } from "@/core/lib/utils"
import type { Habit } from "@/core/types/database"
import type { HabitState } from "@/habits/habits"

// Corregir días pasados sólo existe en hábitos diarios: la escritura es una fila por día,
// y repartir un total semanal/mensual en días es lo que ADR 0009 no quiere (ADR 0013).
export function HabitTileActions({
  h,
  state,
  total,
  running,
  isActive,
  pending,
  quickLabel,
  onQuick,
}: {
  h: Habit
  state: HabitState
  total: number
  running: boolean
  isActive: boolean
  pending: boolean
  quickLabel: string
  onQuick: () => void
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {h.period === "day" && <HabitPanel habit={h} state={state} />}
      <Button
        type="button"
        size="icon-lg"
        onClick={onQuick}
        aria-label={quickLabel}
        aria-pressed={h.metric === "check" ? total > 0 : undefined}
        // ghost traía dark:hover:bg-muted/50 y hover:text-foreground: el hover le pisaba el
        // color brand entero. Con default sólo queda hover:bg para pisar — el color nunca cambia.
        className={cn(
          "shrink-0",
          isActive
            ? "bg-brand text-brand-foreground hover:bg-brand"
            : "bg-brand-soft text-brand-fg hover:bg-brand-soft hover:brightness-110",
          // Hint visual de guardado, NO guard duro: disabled bloquearía el tap siguiente y el
          // onMutate ya serializa los taps encolados (ui-principles 4).
          pending && "opacity-60",
        )}
      >
        {h.metric === "time" ? (
          running ? (
            <Pause className="size-3.5" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play className="size-3.5" fill="currentColor" strokeWidth={0} />
          )
        ) : h.metric === "count" ? (
          <Plus className="size-3.5" strokeWidth={2.2} />
        ) : total > 0 ? (
          <Check className="size-3.5" strokeWidth={3} />
        ) : (
          <span className="size-3.5 rounded-full border-2 border-current opacity-60" />
        )}
      </Button>
    </span>
  )
}
