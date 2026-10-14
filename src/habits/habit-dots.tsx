import { cellColor } from "@/habits/habits"
import type { DayCell } from "@/core/store/derive"
import type { Habit } from "@/core/types/database"

// Dots 7d — proporcionales y monocromos (ADR 0023): tinta a pct sobre --track, cero = --track.
export function HabitDots({ h, dots }: { h: Habit; dots: DayCell[] }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {dots.map((cell, idx) => (
        <i
          key={idx}
          style={{ backgroundColor: cellColor(h.kind, cell, idx === dots.length - 1) }}
          className="size-2 rounded-full"
        />
      ))}
    </span>
  )
}
