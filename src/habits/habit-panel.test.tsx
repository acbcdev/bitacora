import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useHabitLog } from "@/habits/habits.api"
import { deriveHabit } from "@/habits/habits"
import { HabitPanel } from "@/habits/habit-panel"
import { habit, renderApp } from "@/test/harness"
import type { Habit } from "@/core/types/database"

// Como HabitTiles: el state se deriva del log vivo, no de una captura — así el panel ve lo que
// escribe el onMutate.
function PanelHost({ h }: { h: Habit }) {
  const { data: log = [] } = useHabitLog()
  return <HabitPanel habit={h} state={deriveHabit(h, log)} />
}

// El stepper del panel comparte el mismo onMutate que el chip del tile: dos + rápidos suman 2.
test("doble + rápido en el stepper del panel: 0 → 2", async () => {
  const h = habit({ name: "Gym", metric: "count", target: 3, period: "day" })
  renderApp(<PanelHost h={h} />)

  fireEvent.click(screen.getByLabelText("Corregir Gym"))
  const plus = await screen.findByLabelText("Sumar")
  fireEvent.click(plus)
  fireEvent.click(plus)

  await waitFor(() => expect(screen.getByLabelText(/Cantidad de/)).toHaveValue(2))
})

// Un sólo panel a la vez: abrir otro cierra el anterior (antes cada tile tenía su open propio y
// en mobile los drawers se apilaban).
test("abrir el panel de otro hábito cierra el primero", async () => {
  const h1 = habit({ name: "Gym", metric: "count", target: 3, period: "day" })
  const h2 = habit({ name: "Correr", metric: "count", target: 3, period: "day" })
  function Host() {
    const { data: log = [] } = useHabitLog()
    return (
      <>
        <HabitPanel habit={h1} state={deriveHabit(h1, log)} />
        <HabitPanel habit={h2} state={deriveHabit(h2, log)} />
      </>
    )
  }
  renderApp(<Host />)

  fireEvent.click(screen.getByLabelText("Corregir Gym"))
  expect(await screen.findByLabelText("Sumar")).toBeTruthy()
  expect(screen.getAllByLabelText(/Cantidad de/)).toHaveLength(1)

  fireEvent.click(screen.getByLabelText("Corregir Correr"))
  await waitFor(() => expect(screen.getAllByLabelText(/Cantidad de/)).toHaveLength(1))
  expect(screen.getByLabelText("Corregir Gym")).toHaveAttribute("aria-expanded", "false")
})

// La misma convención de derive.periodKey: la semana arranca el lunes (getDay 0=dom).
function monday(d = new Date()) {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// La semana se edita como TOTAL del período, consolidado en UNA fila (la del lunes) — nunca
// repartido en días (ADR 0009). La celda se etiqueta con el rango lun–dom.
test("semana: corregir la semana pasada escribe el total en la fila del lunes", async () => {
  const h = habit({ name: "Gym", metric: "count", target: 3, period: "week" })
  renderApp(<PanelHost h={h} />)

  fireEvent.click(screen.getByLabelText("Corregir Gym"))
  fireEvent.click(await screen.findByLabelText("Período anterior"))

  // La celda pasada muestra el rango numérico, no un día con nombre. Si la semana cruza de mes
  // ("28 sept – 4 oct") el primer extremo lleva mes también.
  await screen.findByText(/\d{1,2}( \w+)? – \d{1,2} \w+/)

  fireEvent.change(screen.getByLabelText(/Cantidad de/), { target: { value: "2" } })

  const lastMonday = dayKey(new Date(monday().setDate(monday().getDate() - 7)))
  await waitFor(() => expect(screen.getByLabelText(/Cantidad de/)).toHaveValue(2))
  const raw = localStorage.getItem("bita-local:habit_log")
  expect(raw).toContain(`"day":"${lastMonday}"`)
  expect(JSON.parse(raw!)[0].amount).toBe(2)
})

// El mes se etiqueta con nombre y año, y consolida en la fila del día 1.
test("mes: corregir un mes pasado escribe el total en la fila del día 1", async () => {
  const h = habit({ name: "Gym", metric: "count", target: 2, period: "month" })
  renderApp(<PanelHost h={h} />)

  fireEvent.click(screen.getByLabelText("Corregir Gym"))
  fireEvent.click(await screen.findByLabelText("Período anterior"))

  await screen.findByText(/ de /) // "agosto de 2026": nombre del mes, no un día

  fireEvent.click(screen.getByLabelText("Sumar"))
  fireEvent.click(screen.getByLabelText("Sumar"))

  const now = new Date()
  const lastMonth = dayKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  await waitFor(() => {
    const raw = localStorage.getItem("bita-local:habit_log")
    expect(JSON.parse(raw!)[0]).toMatchObject({ day: lastMonth, amount: 2 })
  })
})
