import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { MobileDock } from "@/core/components/mobile-chrome"

const scroller = { current: null }

test("el dock muestra el ícono del Agente solo si hay onAgent", () => {
  const onAgent = vi.fn()
  const { rerender } = render(
    <MemoryRouter>
      <MobileDock scroller={scroller} home onSearch={() => {}} onAgent={onAgent} />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole("button", { name: "Agente" }))
  expect(onAgent).toHaveBeenCalled()
  rerender(
    <MemoryRouter>
      <MobileDock scroller={scroller} home onSearch={() => {}} />
    </MemoryRouter>,
  )
  expect(screen.queryByRole("button", { name: "Agente" })).toBeNull()
})
