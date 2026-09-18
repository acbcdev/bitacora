import { cellColor, cellPct } from "@/habits/habits"
import { cn } from "@/core/lib/utils"
import type { DayCell } from "@/core/store/derive"
import type { Habit } from "@/core/types/database"

// Dots 7d — color por pct de la celda, cero = rojo pleno (ADR 0013)
export function HabitDots({ h, dots }: { h: Habit; dots: DayCell[] }) {
  return (
    <span className="flex gap-[3px] pt-0.5" aria-hidden>
      {dots.map((cell, idx) => {
        // Hoy sin resaltado; gris mientras está vacío, color en cuanto hay registro — pero
        // nunca rojo: sin registro no hay recaída que pintar todavía.
        if (idx === dots.length - 1)
          return (
            <i
              key={idx}
              style={{
                backgroundColor: cell.amount > 0 ? cellColor(h.kind, cellPct(cell)) : undefined,
              }}
              className={cn("h-[5px] flex-1 rounded-full", cell.amount === 0 && "bg-muted")}
            />
          )
        return (
          <i
            key={idx}
            style={{ backgroundColor: cellColor(h.kind, cellPct(cell)) }}
            className="h-[5px] flex-1 rounded-full"
          />
        )
      })}
    </span>
  )
}
