import { render } from "@testing-library/react"
import { ReviewStats } from "@/review/review-stats"

const flame = (streak: number) =>
  render(<ReviewStats streak={streak} readToday={0} days={[]} />).container.querySelector(
    ".lucide-flame",
  )

// Verde = vivo (ADR 0023): racha en cero no está viva, el 🔥 va apagado.
test("🔥 verde solo con racha de lectura", () => {
  expect(flame(3)).toHaveClass("text-signal")
  expect(flame(0)).not.toHaveClass("text-signal")
  expect(flame(0)).toHaveClass("text-muted-foreground")
})
