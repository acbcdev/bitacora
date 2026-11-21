import { fireEvent, render, screen } from "@testing-library/react"
import { ReasoningBlock } from "@/agent/reasoning-block"

test("terminado: cerrado con la duración y abre al click", () => {
  render(<ReasoningBlock ms={3400}>Miro la nota.</ReasoningBlock>)
  expect(screen.queryByText("Miro la nota.")).toBeNull()
  fireEvent.click(screen.getByText("Pensó durante 3 s"))
  expect(screen.getByText("Miro la nota.")).toBeInTheDocument()
})

test("el texto del modelo es inerte (no HTML)", () => {
  render(<ReasoningBlock ms={1000}>{"<img src=x onerror=alert(1)>"}</ReasoningBlock>)
  fireEvent.click(screen.getByText("Pensó durante 1 s"))
  expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument()
  expect(document.querySelector("img")).toBeNull()
})
