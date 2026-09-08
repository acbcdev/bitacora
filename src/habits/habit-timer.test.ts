import { dayKey } from "@/core/lib/day"
import {
  clearTimer,
  elapsedMinutes,
  finishTimer,
  pausedValue,
  readTimer,
  shownMinutes,
  startTimer,
  TIMER_KEY,
} from "@/habits/habit-timer"

const { success } = vi.hoisted(() => ({ success: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success } }))

const NOW = 1_800_000_000_000
const SECONDS = (n: number) => n * 1000

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW)
  localStorage.clear()
  success.mockClear()
})

afterEach(() => vi.restoreAllMocks())

test("pausar a los 90s sobre un acumulado de 10 min escribe 690s", () => {
  startTimer("h1")
  // 10 min = 600s + 90s = 690s exactos, sin round (0011).
  expect(pausedValue(600, readTimer()!, NOW + SECONDS(90))).toBe(690)
})

test("pausar antes de 1s no escribe nada", () => {
  startTimer("h1")
  // <1s no hay nada que sumar, así que no hay upsert.
  expect(pausedValue(600, readTimer()!, NOW + 500)).toBe(null)
})

test("reanudar parte del acumulado de la DB, no de cero", () => {
  startTimer("h1")
  const t = readTimer()!
  // shownMinutes ahora es floor(segundos/60), pero el acumulado viene en segundos (720s=12min)
  expect(shownMinutes(720, t, NOW)).toBe(12)
  expect(shownMinutes(720, t, NOW + SECONDS(60))).toBe(13)
})

test("llegar a la meta avisa y apaga el cronómetro", () => {
  startTimer("h1")
  const t = readTimer()!
  const done = NOW + SECONDS(60 * 25)
  expect(shownMinutes(0, t, done) >= 25).toBe(true)

  finishTimer("Leer", 25)
  expect(success).toHaveBeenCalledWith("Leer — 25 min listos")
  expect(localStorage.getItem(TIMER_KEY)).toBe(null)
})

test("un startedAt viejo en localStorage sobrevive al reload", () => {
  // Lo que quedó de la sesión anterior: el transcurrido sale de Date.now() - startedAt, así que
  // recargar no pierde un minuto.
  localStorage.setItem(TIMER_KEY, JSON.stringify({ habitId: "h1", startedAt: NOW - SECONDS(300) }))

  const t = readTimer()!
  expect(t.habitId).toBe("h1")
  expect(elapsedMinutes(t, NOW)).toBe(5)
})

test("localStorage con basura no rompe: no hay cronómetro corriendo", () => {
  localStorage.setItem(TIMER_KEY, "{no-json")
  expect(readTimer()).toBe(null)
})

test("clearTimer borra la clave", () => {
  startTimer("h1")
  clearTimer()
  expect(readTimer()).toBe(null)
})

test("startTimer guarda startedDay: el día local en que arrancó", () => {
  startTimer("h1")
  // Día de atribución decidido AL ARRANCAR, no al pausar: si cruza medianoche, el atributo
  // queda congelado al día de inicio.
  expect(readTimer()!.startedDay).toBe(dayKey(new Date(NOW)))
})

test("timer viejo sin startedDay lo deriva de startedAt al leer", () => {
  const startedAt = NOW - SECONDS(300)
  localStorage.setItem(TIMER_KEY, JSON.stringify({ habitId: "h1", startedAt }))

  const t = readTimer()!
  expect(t.startedDay).toBe(dayKey(new Date(startedAt)))
})
