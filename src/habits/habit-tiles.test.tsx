import { fireEvent, screen, waitFor } from "@testing-library/react"
import { HabitTiles } from "@/habits/habit-tiles"
import { habit, habitLogRow, renderApp } from "@/test/harness"

// Doble click rápido sobre el chip: cada click es su propio evento y el onMutate resuelve el +1
// contra el cache, así que el DOM pasa a 2/3 sin frame intermedio con 1/3 pisado.
test("doble tap rápido en count: 0/3 → 2/3", async () => {
  const h = habit({ name: "Gym", metric: "count", target: 3, period: "day" })
  renderApp(<HabitTiles />, { habits: [h], habitLog: [] })
  await screen.findByText("Gym")

  const chip = () => screen.getAllByRole("button", { name: "Registrar Gym" })[0]
  fireEvent.click(chip())
  fireEvent.click(chip())

  await screen.findByText("2/3")
})

test("doble tap rápido en check: toggle 0→1→0", async () => {
  const h = habit({ name: "Meditar", metric: "check", target: 1, period: "day" })
  renderApp(<HabitTiles />, { habits: [h], habitLog: [] })
  await screen.findByText("Meditar")

  // Los tres superficies clickeables comparten aria-label; el [0] (el ícono) lleva aria-pressed.
  const chip = () => screen.getAllByRole("button", { name: "Registrar Meditar" })[0]
  fireEvent.click(chip())
  await waitFor(() => expect(chip()).toHaveAttribute("aria-pressed", "true"))
  fireEvent.click(chip())
  await waitFor(() => expect(chip()).toHaveAttribute("aria-pressed", "false"))
})

// Spec "Hábito": cumplido = bloque lleno + check verde — también en count/time, no solo check.
test("count cumplido muestra el check verde", async () => {
  const h = habit({ name: "Agua", metric: "count", target: 3 })
  renderApp(<HabitTiles />, {
    habits: [h],
    habitLog: [habitLogRow({ habit_id: h.id, amount: 3, target: 3 })],
  })
  const check = await screen.findByRole("img", { name: "cumplido" })
  expect(check.closest(".text-signal")).not.toBeNull()
})

// Spec "Hábito": pasado = número rojo. El nombre sigue en tinta.
test("bad pasado: número rojo, nombre en tinta", async () => {
  const h = habit({ name: "Azúcar", kind: "bad", metric: "count", target: 1 })
  renderApp(<HabitTiles />, {
    habits: [h],
    habitLog: [habitLogRow({ habit_id: h.id, amount: 3, target: 1 })],
  })
  const name = (await screen.findAllByText("Azúcar"))[0]
  expect(name.closest(".text-destructive")).toBeNull()
  expect(screen.getByText("3").closest(".text-destructive")).not.toBeNull()
})
