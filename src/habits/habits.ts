import type { Habit, HabitPeriod } from "@/core/types/database"
import type { DayCell } from "@/core/store/derive"

// Derivación ahora vive en derive.ts — este archivo queda como display + re-export shim.
// La forma de la fila la define el seam (core/store/types), que es quien la produce en los dos
// adapters. Se re-exporta desde acá porque este es el módulo que la consume.
export type { HabitLogRow } from "@/core/store/types"

// Re-exports de derivación — fuente de verdad: src/core/store/derive.ts
export {
  type DayCell,
  type HabitState,
  SERIES,
  meets,
  periodKey,
  dayAt,
  parseDay,
  deriveHabit,
  habitState,
} from "@/core/store/derive"

const PERIOD_SHORT: Record<HabitPeriod, string> = { day: "día", week: "semana", month: "mes" }

export const unit = (h: Pick<Habit, "metric">) => (h.metric === "time" ? " min" : "")

export const displayTarget = (h: Pick<Habit, "metric" | "target">) =>
  h.metric === "time" ? Math.round(h.target / 60) : h.target

export const displayAmount = (h: Pick<Habit, "metric">, amountSec: number) =>
  h.metric === "time" ? Math.floor(amountSec / 60) : amountSec

// "3/semana", "25 min/día", "máx 0/día" — la meta en una línea. Un número suelto no dice si es
// piso o techo; el "máx" sí. Para time, target viene en segundos (0011), se muestra en min.
export const goalText = (h: Pick<Habit, "kind" | "metric" | "target" | "period">) =>
  `${h.kind === "bad" ? "máx " : ""}${displayTarget(h)}${unit(h)}/${PERIOD_SHORT[h.period]}`

// Unidad del 🔥 por período (ADR 0013): diario número solo, semanal/mensual con unidad.
const STREAK_UNIT: Record<HabitPeriod, string> = { day: "", week: " sem", month: " mes" }

export const streakText = (h: Pick<Habit, "period">, streak: number) =>
  `${streak}${STREAK_UNIT[h.period]}`

// pct de cumplimiento de una celda: amount/target del período, clamp 100. El techo 0 de un `bad`
// cae en max(target, 1): cualquier amount da pct 100.
export const cellPct = (cell: DayCell) =>
  Math.min(100, (cell.amount / Math.max(cell.target, 1)) * 100)

// Mezcla rojo↔verde por pct (color-mix, ADR 0013). En `bad` la escala va al revés: limpio (0)
// es verde, pasarse es rojo. Cero = extremo rojo, sin excepciones.
export const cellColor = (kind: Habit["kind"], pct: number) => {
  const done = Math.round(kind === "good" ? pct : 100 - pct)
  return `color-mix(in oklab, var(--brand) ${done}%, var(--destructive))`
}
