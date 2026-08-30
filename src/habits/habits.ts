import type { Habit, HabitPeriod } from "@/core/types/database"

// Derivación ahora vive en derive.ts — este archivo queda como display + re-export shim.
// La forma de la fila la define el seam (core/store/types), que es quien la produce en los dos
// adapters. Se re-exporta desde acá porque este es el módulo que la consume.
export type { HabitLogRow } from "@/core/store/types"

// Re-exports de derivación — fuente de verdad: src/core/store/derive.ts
export {
  type DayCell,
  type HabitState,
  TRACKED_DAYS,
  meets,
  periodKey,
  dayAt,
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
