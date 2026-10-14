import { cellPct, dotColor } from "@/habits/habits"
import type { DayCell } from "@/core/store/derive"
import type { Habit } from "@/core/types/database"

// Dots 7d — proporcionales y monocromos (ADR 0023): tinta a pct sobre --track, cero = --track.
export function HabitDots({ h, dots }: { h: Habit; dots: DayCell[] }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {dots.map((cell, idx) => (
        <i
          key={idx}
          // Hoy sin registro = track: en un `bad` el 0 invertido pintaría "limpio" antes de que
          // el día termine.
          style={{
            backgroundColor:
              idx === dots.length - 1 && cell.amount === 0
                ? "var(--track)"
                : dotColor(h.kind, cellPct(cell)),
          }}
          className="size-2 rounded-full"
        />
      ))}
    </span>
  )
}
