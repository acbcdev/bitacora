import { waitFor } from "@testing-library/react"
import { todayKey } from "@/core/lib/day"
import { SNAPSHOT_KEY, useSnapshot } from "@/core/lib/snapshot"
import type { Snapshot } from "@/core/store/types"
import { useSetDay } from "@/habits/habits.api"
import { habit, habitLogRow, renderApp } from "@/test/harness"
import type { Habit } from "@/core/types/database"

// Seam Store (spec habit-quick-increment): el +1 se decide en el onMutate optimista, leyendo el
// cache en el instante del mutate — no la render, que puede estar vieja. Dos mutates seguidos sin
// await reproducen el doble tap rápido sin esperar timers.
let nudge!: (delta: number) => void
let set!: (value: number) => void

function Probe({ h }: { h: Habit }) {
  // Monta la query del snapshot: sin esto el cache nunca carga y el onMutate no tiene nada.
  useSnapshot((s) => s.habitLog)
  const setDay = useSetDay()
  nudge = (delta: number) => setDay.mutate({ habit: h, day: todayKey(), delta })
  set = (value: number) => setDay.mutate({ habit: h, day: todayKey(), value })
  return null
}

const countHabit = () => habit({ id: "h1", name: "Gym", metric: "count", target: 3, period: "day" })

function renderProbe(h: Habit) {
  return renderApp(<Probe h={h} />, { habits: [h] })
}

test("dos mutaciones rápidas con delta +1 suman 2, no dos veces 1", async () => {
  const h = countHabit()
  const { qc, store } = renderProbe(h)
  await waitFor(() => expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)).toBeTruthy())

  nudge(1)
  nudge(1) // sin await: el segundo no ve cache "fresco" por render — lo lee el onMutate

  await waitFor(() =>
    expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.habitLog).toEqual([
      expect.objectContaining({ habit_id: "h1", day: todayKey(), amount: 2, target: 3 }),
    ]),
  )
  // Lo persistido coincide con el cache optimista (el último upsert manda).
  const snap = await store.snapshot()
  expect(snap.habitLog.find((r) => r.habit_id === "h1")?.amount).toBe(2)
})

test("delta −1 desde cero queda en cero, nunca negativo", async () => {
  const h = countHabit()
  const { qc } = renderProbe(h)
  await waitFor(() => expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)).toBeTruthy())

  nudge(-1)
  await waitFor(() => expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.habitLog[0]?.amount).toBe(0))
})

test("value es un set absoluto: el toggle de check escribe 0/1 tal cual", async () => {
  const h = habit({ id: "h1", metric: "check", target: 1 })
  const { qc } = renderProbe(h)
  await waitFor(() => expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)).toBeTruthy())

  set(1)
  await waitFor(() => expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.habitLog[0]?.amount).toBe(1))
  set(0)
  await waitFor(() => expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.habitLog[0]?.amount).toBe(0))
})

test("fila nueva congela el target del hábito (ADR 0009); fila vieja lo conserva", async () => {
  const h = habit({ id: "h1", metric: "count", target: 5, period: "day" })
  const { qc } = renderApp(<Probe h={h} />, {
    habits: [h],
    habitLog: [habitLogRow({ habit_id: "h1", amount: 1, target: 3 })],
  })
  await waitFor(() => expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)).toBeTruthy())

  nudge(1)
  await waitFor(() =>
    expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.habitLog).toEqual([
      expect.objectContaining({ habit_id: "h1", amount: 2, target: 3 }),
    ]),
  )
})
