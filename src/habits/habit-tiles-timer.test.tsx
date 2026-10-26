// Cross-midnight del Cronómetro sobre los tiles (spec habit-timer-attribution). La pausa y el
// auto-finish acreditan TODO el elapsed al Día de atribución (startedDay), no al día de hoy.
import { useEffect } from "react"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { HabitTiles } from "@/habits/habit-tiles"
import { finishTimer } from "@/habits/habit-timer"
import { dayKey } from "@/core/lib/day"
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
type TimerOver = { startedDay?: string; startedAt?: number }

function TimerSeed({ over }: { over: TimerOver }) {
  useEffect(() => {
    localStorage.setItem(
      "bita-timer",
      JSON.stringify({ habitId: "h1", startedAt: STARTED_AT, ...over }),
    )
  }, [over])
  return null
}

function mountWithTimer(seed: Partial<Snapshot>, timerOver: TimerOver = {}) {
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

test("pausa cross-midnight: el cache optimista ya tiene la fila de startedDay antes del round-trip", async () => {
  const seed: Partial<Snapshot> = {
    habits: [timeHabit()],
    habitLog: [habitLogRow({ habit_id: "h1", day: DAY_START, amount: 12 * MIN, target: 60 * MIN })],
  }
  const { qc, store } = mountWithTimer(seed)
  const pause = (await screen.findAllByRole("button", { name: "Pausar Leer" }))[0]
  fireEvent.click(pause)

  // El onMutate escribe el cache ANTES del round-trip (ui-principles 4): la fila correcta de
  // startedDay tiene que estar visible sin esperar la persistencia.
  await waitFor(() => {
    const snap = qc.getQueryData<Snapshot>(["snapshot"])
    expect(snap?.habitLog).toEqual([
      { habit_id: "h1", day: DAY_START, amount: 32 * MIN, target: 60 * MIN },
    ])
  })
  // Y el round-trip lo confirma.
  await waitFor(async () => {
    expect((await store.snapshot()).habitLog).toEqual([
      { habit_id: "h1", day: DAY_START, amount: 32 * MIN, target: 60 * MIN },
    ])
  })
})

// auto-finish acredita amount_startedDay + elapsed y corta con toast
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

// Tab oculto: Chrome baja el interval de 1s a 1/min. El auto-finish no puede depender de él —
// con el interval anulado, el timeout al deadline igual corta.
test("auto-finish llega a tiempo aunque el interval esté throttleado", async () => {
  nowSpy.mockRestore()
  const realSetInterval = globalThis.setInterval
  vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void, ms?: number) =>
    ms === 1000 ? 0 : realSetInterval(fn, ms)) as typeof setInterval)
  const today = dayKey(new Date())
  const seed: Partial<Snapshot> = {
    habits: [timeHabit({ target: 20 * MIN })],
    habitLog: [habitLogRow({ habit_id: "h1", day: today, amount: 18 * MIN, target: 20 * MIN })],
  }
  // Faltan ~300ms para los 20 min.
  mountWithTimer(seed, { startedAt: Date.now() - 2 * MIN * 1000 + 300, startedDay: today })

  await waitFor(() => expect(success).toHaveBeenCalledWith("Leer — 20 min listos"), {
    timeout: 2000,
  })
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

test("hero con el timer corriendo amplía (no pausa); el número del zoom pausa; Esc cierra", async () => {
  mountWithTimer({ habits: [timeHabit()], habitLog: [] })
  await screen.findAllByRole("button", { name: "Pausar Leer" })
  const hero = screen.getByText(
    (_, el) => el?.tagName === "BUTTON" && !!el.textContent?.startsWith("20:00/"),
  )
  fireEvent.click(hero)

  const zoom = await screen.findByRole("dialog", { name: "Leer" })
  expect(zoom).toHaveTextContent("20:00/60 min")
  expect(localStorage.getItem("bita-timer")).not.toBe(null)

  // El número del zoom pausa sin cerrar.
  fireEvent.click(within(zoom).getByText("20:00"))
  await waitFor(() => expect(localStorage.getItem("bita-timer")).toBe(null))
  expect(screen.getByRole("dialog", { name: /^Leer.*pausado$/ })).toBeInTheDocument()

  fireEvent.keyDown(zoom, { key: "Escape" })
  await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null))
})
