import { deriveHabit, periodKey, type HabitLogRow } from "@/habits/habits"
import type { Habit } from "@/core/types/database"

// Jueves 20 de agosto de 2026, mediodía. La semana en curso va del lun 17 al dom 23; la anterior,
// del lun 10 al dom 16. Todo el archivo se apoya en esas fechas: `now` es fijo, nada de Date.now().
const NOW = new Date(2026, 7, 20, 12)

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    user_id: "u1",
    name: "Gym",
    icon: null,
    kind: "good",
    metric: "count",
    target: 1,
    period: "day",
    days: null,
    deleted_at: null,
    created_at: "2026-01-01T12:00:00Z",
    ...over,
  }
}

const row = (day: string, amount: number, target: number): HabitLogRow => ({
  habit_id: "h1",
  day,
  amount,
  target,
})

test("periodKey: día tal cual, semana = lunes, mes = YYYY-MM", () => {
  expect(periodKey(NOW, "day")).toBe("2026-08-20")
  expect(periodKey(NOW, "week")).toBe("2026-08-17")
  expect(periodKey(NOW, "month")).toBe("2026-08")
  // Domingo cae en la semana que arranca el lunes anterior, no en la siguiente.
  expect(periodKey(new Date(2026, 7, 23, 23), "week")).toBe("2026-08-17")
})

test("good 3/semana a mitad de semana: todavía no cumple, pero no corta la racha", () => {
  const h = habit({ target: 3, period: "week" })
  const rows = [
    row("2026-08-17", 1, 3), // esta semana: 2 de 3
    row("2026-08-18", 1, 3),
    row("2026-08-10", 1, 3), // semana pasada: 3 de 3
    row("2026-08-11", 1, 3),
    row("2026-08-12", 1, 3),
    row("2026-08-03", 3, 3), // la anterior: una sola fila de 3
  ]

  const s = deriveHabit(h, rows, NOW)
  expect(s.total).toBe(2)
  expect(s.met).toBe(false)
  // El período actual sin cumplir no corta (misma regla que deriveReadStats).
  expect(s.streak).toBe(2)
})

test("good que llega al target cumple y el período actual entra en la racha", () => {
  const h = habit({ target: 3, period: "week" })
  const rows = [
    row("2026-08-17", 1, 3),
    row("2026-08-18", 1, 3),
    row("2026-08-19", 1, 3),
    row("2026-08-10", 3, 3),
  ]

  const s = deriveHabit(h, rows, NOW)
  expect(s.total).toBe(3)
  expect(s.met).toBe(true)
  expect(s.streak).toBe(2)
})

test("bad con techo 0 y sin filas cumple: un período sin registros es un período limpio", () => {
  const h = habit({ kind: "bad", target: 0, created_at: "2026-08-16T12:00:00Z" })

  const s = deriveHabit(h, [], NOW)
  expect(s.total).toBe(0)
  expect(s.met).toBe(true)
  // 16, 17, 18, 19 y 20 — la racha no puede empezar antes de que el hábito exista.
  expect(s.streak).toBe(5)
})

test("bad con una recaída hoy corta la racha", () => {
  const h = habit({ kind: "bad", target: 0, created_at: "2026-08-16T12:00:00Z" })

  const s = deriveHabit(h, [row("2026-08-20", 1, 0)], NOW)
  expect(s.total).toBe(1)
  expect(s.met).toBe(false)
  expect(s.streak).toBe(0)
})

test("una recaída del período anterior no borra los períodos limpios previos", () => {
  const h = habit({ kind: "bad", target: 0, created_at: "2026-08-15T12:00:00Z" })
  const rows = [row("2026-08-19", 2, 0)]

  // Hoy está limpio, pero la racha arranca de cero: el 19 la cortó.
  expect(deriveHabit(h, rows, NOW).streak).toBe(1)
  // Y los días previos al 19 siguen contando como limpios — 15, 16, 17 y 18.
  expect(deriveHabit(h, rows, new Date(2026, 7, 18, 12)).streak).toBe(4)
})

test("time suma los segundos de cada día, no cuenta filas", () => {
  const h = habit({ metric: "time", target: 150 * 60, period: "week" })
  const rows = [row("2026-08-17", 30 * 60, 150 * 60), row("2026-08-18", 45 * 60, 150 * 60)]

  expect(deriveHabit(h, rows, NOW).total).toBe(75 * 60)
})

test("subir la meta no reescribe las rachas viejas: cada fila lleva su target (ADR 0009)", () => {
  // 16 días seguidos de exactamente 10 minutos (5 al 20 de agosto), todos con target 10 congelado.
  const rows = Array.from({ length: 16 }, (_, i) =>
    row(`2026-08-${String(5 + i).padStart(2, "0")}`, 10 * 60, 10 * 60),
  )
  const base = {
    metric: "time" as const,
    period: "day" as const,
    created_at: "2026-08-01T12:00:00Z",
  }

  const antes = deriveHabit(habit({ ...base, target: 10 * 60 }), rows, NOW)
  expect(antes.met).toBe(true)
  expect(antes.streak).toBe(16)

  // Meta a 20: el período ACTUAL se re-puntúa contra la meta viva (10 < 20 → no cumple)...
  const despues = deriveHabit(habit({ ...base, target: 20 * 60 }), rows, NOW)
  expect(despues.met).toBe(false)
  // ...pero los 15 días cerrados siguen cumplidos contra el target de sus filas.
  expect(despues.streak).toBe(15)
})

test("habits.days es recordatorio: el mismo log da idéntico resultado con y sin días", () => {
  const rows = [row("2026-08-17", 1, 3), row("2026-08-18", 1, 3), row("2026-08-10", 3, 3)]
  const base = { target: 3, period: "week" as const }

  const sin = deriveHabit(habit({ ...base, days: null }), rows, NOW)
  const con = deriveHabit(habit({ ...base, days: [1, 3, 5] }), rows, NOW)
  expect(con).toEqual(sin)
})

test("days son 14 posiciones, de hace 13 días a hoy, con amount y target de cada fila", () => {
  const h = habit({ metric: "time", target: 25 * 60 })
  const rows = [
    row("2026-08-20", 10 * 60, 25 * 60),
    row("2026-08-07", 40 * 60, 15 * 60),
    row("2026-07-30", 99 * 60, 25 * 60),
  ]

  const { days } = deriveHabit(h, rows, NOW)
  expect(days).toHaveLength(14)
  expect(days[13]).toEqual({ amount: 10 * 60, target: 25 * 60 })
  expect(days[0]).toEqual({ amount: 40 * 60, target: 15 * 60 }) // el target viejo, no el vivo
  // Un día sin fila no tiene target congelado: cae en el actual del hábito.
  expect(days[1]).toEqual({ amount: 0, target: 25 * 60 })
})

test("las filas de otros hábitos no entran en el cálculo", () => {
  const rows = [row("2026-08-20", 1, 1), { ...row("2026-08-20", 5, 1), habit_id: "otro" }]

  expect(deriveHabit(habit(), rows, NOW).total).toBe(1)
})
