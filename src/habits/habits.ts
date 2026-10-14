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
  periodStartAt,
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

// Inverso de displayTarget/displayAmount: minutos de display → segundos de storage (0011).
export const fromDisplay = (metric: Habit["metric"], v: number) => (metric === "time" ? v * 60 : v)

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

// Dot monocromo proporcional (ADR 0023, enmienda 0013 §2–3): tinta a pct sobre --track. En `bad`
// la escala va al revés (limpio = tinta plena, techo = track). Cero = --track, sin rojo.
export const dotColor = (kind: Habit["kind"], pct: number) => {
  const done = Math.round(kind === "good" ? pct : 100 - pct)
  return done === 0
    ? "var(--track)"
    : `color-mix(in oklab, var(--foreground) ${done}%, var(--track))`
}

// Color de una celda de serie (dots 7d e historial). Hoy sin registro = --track: en un `bad` el 0
// invertido pintaría "limpio" antes de que el día termine.
export const cellColor = (kind: Habit["kind"], cell: DayCell, isToday: boolean) =>
  isToday && cell.amount === 0 ? "var(--track)" : dotColor(kind, cellPct(cell))
