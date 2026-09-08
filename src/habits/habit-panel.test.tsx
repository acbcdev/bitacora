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
