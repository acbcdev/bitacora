import { dayKey } from "@/core/lib/stats"
import type { Habit, HabitKind, HabitPeriod } from "@/core/types/database"

// Derivación de hábitos: funciones puras, sin React ni acceso a datos. Mismo enfoque que
// core/lib/stats.ts — el log entero baja al cliente y se agrega acá.

// La forma de la fila la define el seam (core/store/types), que es quien la produce en los dos
// adapters. Se re-exporta desde acá porque este es el módulo que la consume.
export type { HabitLogRow } from "@/core/store/types"
import type { HabitLogRow } from "@/core/store/types"

export type DayCell = { amount: number; target: number }
export type HabitState = { total: number; met: boolean; streak: number; days: DayCell[] }

// Ventana fija del panel. Más atrás es un calendario, que es otra UI (spec: Out of Scope).
export const TRACKED_DAYS = 14

const PERIOD_SHORT: Record<HabitPeriod, string> = { day: "día", week: "semana", month: "mes" }

export const unit = (h: Pick<Habit, "metric">) => (h.metric === "time" ? " min" : "")

// "3/semana", "25 min/día", "máx 0/día" — la meta en una línea. Un número suelto no dice si es
// piso o techo; el "máx" sí.
export const goalText = (h: Pick<Habit, "kind" | "metric" | "target" | "period">) =>
  `${h.kind === "bad" ? "máx " : ""}${h.target}${unit(h)}/${PERIOD_SHORT[h.period]}`

// good = piso (llegar al target), bad = techo (no pasarlo). Mismo cálculo, signo distinto.
export const meets = (kind: HabitKind, total: number, target: number) =>
  kind === "good" ? total >= target : total <= target

// La fecha del índice `i` de la serie de 14 (13 = hoy).
export function dayAt(i: number, now = new Date()) {
  const d = new Date(now)
  d.setDate(d.getDate() - (TRACKED_DAYS - 1 - i))
  return d
}

// habit_log.day ya es fecha local (ADR 0009): se parsea con las partes explícitas y NO con
// new Date(day), que lo leería como UTC y a la noche devolvería el día anterior.
function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d)
}

// El lunes de esa semana. getDay() es 0=dom, así que el corrimiento es (día + 6) % 7.
function monday(d: Date) {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

const KEY: Record<HabitPeriod, (d: Date) => string> = {
  day: dayKey,
  week: (d) => dayKey(monday(d)),
  month: (d) => dayKey(d).slice(0, 7),
}

// Clave del período que contiene `d`. Las tres ordenan lexicográficamente igual que
// cronológicamente, que es lo que hace comparable "¿este período es anterior al de created_at?".
export function periodKey(d: Date, period: HabitPeriod) {
  return KEY[period](d)
}

// Muta el cursor un período hacia atrás. En `month` primero va al día 1: sin eso, restarle un mes
// al 31 de marzo cae en marzo otra vez (31 de febrero no existe).
const stepBack: Record<HabitPeriod, (d: Date) => void> = {
  day: (d) => d.setDate(d.getDate() - 1),
  week: (d) => d.setDate(d.getDate() - 7),
  month: (d) => {
    d.setDate(1)
    d.setMonth(d.getMonth() - 1)
  },
}

// `total` es la SUMA de amount del período (en `time`, minutos), no un count: las tres métricas
// comparten esta función y no hay una sola rama por métrica.
// `habit.days` (el schedule lun/mié/vie) no se lee acá a propósito — es recordatorio, no regla
// (ADR 0009). Si alguna vez aparece en este archivo, está mal.
export function deriveHabit(habit: Habit, rows: HabitLogRow[], now = new Date()): HabitState {
  const byDay = new Map<string, HabitLogRow>()
  // Un período = { suma de amount, target congelado }. Con varias filas y targets distintos en el
  // mismo período gana el de la fila más nueva.
  const periods = new Map<string, { total: number; target: number; day: string }>()

  for (const r of rows) {
    if (r.habit_id !== habit.id) continue
    byDay.set(r.day, r)
    const key = periodKey(parseDay(r.day), habit.period)
    const prev = periods.get(key)
    if (!prev) {
      periods.set(key, { total: r.amount, target: r.target, day: r.day })
    } else {
      prev.total += r.amount
      if (r.day > prev.day) {
        prev.target = r.target
        prev.day = r.day
      }
    }
  }

  const currentKey = periodKey(now, habit.period)
  const metAt = (key: string) => {
    const p = periods.get(key)
    // El período actual se puntúa contra la meta VIVA (subirla hoy re-puntúa hoy); los cerrados,
    // contra el target congelado de sus filas — eso es lo que sostiene las rachas viejas (ADR 0009).
    const target = key === currentKey ? habit.target : (p?.target ?? habit.target)
    return meets(habit.kind, p?.total ?? 0, target)
  }

  const met = metAt(currentKey)

  // Racha = períodos cumplidos consecutivos hacia atrás. El piso es el período en que se creó el
  // hábito: antes de existir no hay nada que cumplir (y sin ese piso un `bad` sin filas contaría
  // hacia atrás para siempre).
  const floor = periodKey(new Date(habit.created_at), habit.period)
  const cursor = new Date(now)
  // En un `good`, el período actual todavía sin cumplir no corta la racha (misma regla que
  // deriveReadStats). En un `bad` sí: pasarse del techo es el fracaso, no una tarea pendiente.
  if (!met && habit.kind === "good") stepBack[habit.period](cursor)
  let streak = 0
  while (periodKey(cursor, habit.period) >= floor && metAt(periodKey(cursor, habit.period))) {
    streak++
    stepBack[habit.period](cursor)
  }

  // Serie de los últimos 14 días (0 = hace 13 días, 13 = hoy). Sale del mismo array de filas: cero
  // queries extra. Un día sin fila no tiene target congelado — cae en el actual del hábito.
  const days: DayCell[] = []
  const cursorDay = new Date(now)
  cursorDay.setDate(cursorDay.getDate() - (TRACKED_DAYS - 1))
  for (let i = 0; i < TRACKED_DAYS; i++) {
    const r = byDay.get(dayKey(cursorDay))
    days.push({ amount: r?.amount ?? 0, target: r?.target ?? habit.target })
    cursorDay.setDate(cursorDay.getDate() + 1)
  }

  return { total: periods.get(currentKey)?.total ?? 0, met, streak, days }
}
