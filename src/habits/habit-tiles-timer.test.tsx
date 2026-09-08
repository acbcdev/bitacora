// Cross-midnight del Cronómetro sobre los tiles (spec habit-timer-attribution). La pausa y el
// auto-finish acreditan TODO el elapsed al Día de atribución (startedDay), no al día de hoy.
import { useEffect } from "react"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { HabitTiles } from "@/habits/habit-tiles"
import { finishTimer } from "@/habits/habit-timer"
import { habit, habitLogRow, renderApp } from "@/test/harness"
import type { Snapshot } from "@/core/store/types"

vi.mock("@/core/store", async () => {
  const { localStore } = await import("@/core/store/local-store")
  return { store: localStore() }
})

const { success } = vi.hoisted(() => ({ success: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success } }))

// Lunes 20 de agosto de 2026, 00:19. El timer arrancó el domingo 19 a las 23:59 — el caso
// verbatim del spec. Todo determinista: Date.now mockeado, timer sembrado en localStorage.
const NOW = new Date(2026, 7, 20, 0, 19, 0)
const STARTED_AT = NOW.getTime() - 20 * 60 * 1000 // dom 19, 23:59
const DAY_START = "2026-08-19"

const MIN = 60

function timeHabit(over = {}) {
  return habit({
    id: "h1",
    name: "Leer",
    kind: "good",
    metric: "time",
    target: 60 * MIN, // 60 min/día en segundos (0011)
    period: "day",
    created_at: "2026-08-01T12:00:00Z",
    ...over,
  })
}

// renderApp hace localStorage.clear() al seedear, así que el timer se siembra en un useEffect
// del mount: las queries de la app resuelven después (async) y el rerender de useSyncExternalStore
// ya lo ve. Sin rerender manual ni storage events.
function TimerSeed({ over }: { over: { startedDay?: string } }) {
  useEffect(() => {
    localStorage.setItem(
      "bita-timer",
      JSON.stringify({ habitId: "h1", startedAt: STARTED_AT, ...over }),
    )
  }, [over])
  return null
}

function mountWithTimer(seed: Partial<Snapshot>, timerOver: { startedDay?: string } = {}) {
  return renderApp(
    <>
      <TimerSeed over={timerOver} />
      <HabitTiles />
    </>,
    seed,
  )
}

let nowSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  nowSpy = vi.spyOn(Date, "now").mockReturnValue(NOW.getTime())
  success.mockClear()
})

afterEach(() => vi.restoreAllMocks())

test("pausa cross-midnight: un solo upsert sobre startedDay con amount_prev + elapsed", async () => {
  const seed: Partial<Snapshot> = {
    habits: [timeHabit()],
    habitLog: [habitLogRow({ habit_id: "h1", day: DAY_START, amount: 12 * MIN, target: 60 * MIN })],
  }
  const { store } = mountWithTimer(seed)
  const pause = (await screen.findAllByRole("button", { name: "Pausar Leer" }))[0]
  fireEvent.click(pause)

  // El round-trip real (adapter local), no el cache optimista: 12 min + 20 min = 32, a AYER.
  await waitFor(async () => {
    expect((await store.snapshot()).habitLog).toEqual([
      { habit_id: "h1", day: DAY_START, amount: 32 * MIN, target: 60 * MIN },
    ])
  })
  // El timer quedó apagado.
  expect(localStorage.getItem("bita-timer")).toBe(null)
})

test("auto-finish acredita amount_startedDay + elapsed y corta con toast", async () => {
  // Historia 4: 18 min ya registrados ayer, arrancó 23:59 y a los 3 min (00:02) cruza la meta
  // de 20: corta solo, escribe 21 a AYER y no espera a que HOY llegue a 20.
  nowSpy.mockReturnValue(new Date(2026, 7, 20, 0, 2, 0).getTime())
  const seed: Partial<Snapshot> = {
    habits: [timeHabit({ target: 20 * MIN })],
    habitLog: [habitLogRow({ habit_id: "h1", day: DAY_START, amount: 18 * MIN, target: 20 * MIN })],
  }
  const { store } = mountWithTimer(seed)

  await waitFor(async () => {
    expect((await store.snapshot()).habitLog).toEqual([
      { habit_id: "h1", day: DAY_START, amount: 21 * MIN, target: 20 * MIN },
    ])
  })
  expect(success).toHaveBeenCalledWith("Leer — 21 min listos")
  expect(localStorage.getItem("bita-timer")).toBe(null)
})

test("timer viejo sin startedDay: la pausa igual acredita al día derivado de startedAt", async () => {
  const seed: Partial<Snapshot> = {
    habits: [timeHabit()],
    habitLog: [],
  }
  const { store } = mountWithTimer(seed, { startedDay: undefined })
  const pause = (await screen.findAllByRole("button", { name: "Pausar Leer" }))[0]
  fireEvent.click(pause)

  await waitFor(async () => {
    expect((await store.snapshot()).habitLog).toEqual([
      { habit_id: "h1", day: DAY_START, amount: 20 * MIN, target: 60 * MIN },
    ])
  })
})

test("finishTimer con valor en segundos anuncia minutos", () => {
  finishTimer("Leer", 21 * 60)
  expect(success).toHaveBeenCalledWith("Leer — 21 min listos")
})
