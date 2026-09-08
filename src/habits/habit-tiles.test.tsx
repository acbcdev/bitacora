import { fireEvent, screen, waitFor } from "@testing-library/react"
import { HabitTiles } from "@/habits/habit-tiles"
import { habit, renderApp } from "@/test/harness"

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
