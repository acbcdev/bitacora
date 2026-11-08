import { render, screen } from "@testing-library/react"
import { ReadChip } from "@/review/review-stats"

const flame = (streak: number) =>
  render(<ReadChip streak={streak} readToday={0} goal={3} />).container.querySelector(
    ".lucide-flame",
  )

// Verde = vivo (ADR 0023): racha en cero no está viva, el 🔥 va apagado.
test("🔥 verde solo con racha de lectura", () => {
  expect(flame(3)).toHaveClass("text-signal")
  expect(flame(0)).not.toHaveClass("text-signal")
  expect(flame(0)).toHaveClass("text-muted-foreground")
})

// El número de la racha se pinta solo cuando hoy ya suma: meta cumplida.
test("número de racha verde solo con la meta de hoy cumplida", () => {
  const { rerender } = render(<ReadChip streak={4} readToday={2} goal={3} />)
  expect(screen.getByText("4")).not.toHaveClass("text-signal")
  rerender(<ReadChip streak={4} readToday={3} goal={3} />)
  expect(screen.getByText("4")).toHaveClass("text-signal")
})
