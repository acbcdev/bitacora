import { cellColor } from "@/habits/habits"
import type { DayCell } from "@/core/store/derive"
import type { Habit, HabitPeriod } from "@/core/types/database"

// Ancho ∝ período: cada celda es un período entero (ADR 0013), no un día.
const WIDTH: Record<HabitPeriod, string> = { day: "w-2", week: "w-5", month: "w-7" }

// Dots 7d — proporcionales y monocromos (ADR 0023): tinta a pct sobre --track, cero = --track.
export function HabitDots({ h, dots }: { h: Habit; dots: DayCell[] }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {dots.map((cell, idx) => (
        <i
          key={idx}
          style={{ backgroundColor: cellColor(h.kind, cell, idx === dots.length - 1) }}
          className={`h-2 ${WIDTH[h.period]} rounded-full`}
        />
      ))}
    </span>
  )
}
