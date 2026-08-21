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

test("pausar a los 90s sobre un acumulado de 10 escribe 12, no 2", () => {
  startTimer("h1")
  // 90s son 1.5 min → round = 2, y se suman a lo que ya había en la DB.
  expect(pausedValue(10, readTimer()!, NOW + SECONDS(90))).toBe(12)
})

test("pausar antes del minuto no escribe nada", () => {
  startTimer("h1")
  // round(20/60) = 0: no hay minuto que sumar, así que no hay upsert.
  expect(pausedValue(10, readTimer()!, NOW + SECONDS(20))).toBe(null)
})

test("reanudar parte del acumulado de la DB, no de cero", () => {
  startTimer("h1")
  const t = readTimer()!
  expect(shownMinutes(12, t, NOW)).toBe(12)
  expect(shownMinutes(12, t, NOW + SECONDS(60))).toBe(13)
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
