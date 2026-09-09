import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { HabitsDialog } from "@/habits/habits-dialog"

const { save } = vi.hoisted(() => ({
  save: vi.fn((_entity: string, _input: unknown) => Promise.resolve()),
}))

vi.mock("@/core/store", () => ({
  store: {
    snapshot: async () => ({ notebooks: [], notes: [], reads: [], habits: [], habitLog: [] }),
    save,
  },
}))

function renderNew() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <HabitsDialog startNew onClose={vi.fn()} />
    </QueryClientProvider>,
  )
}

beforeEach(() => save.mockClear())

test("crear un hábito por semana manda period: week", async () => {
  renderNew()

  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Gym" } })
  fireEvent.change(screen.getByLabelText("Frecuencia"), { target: { value: "week" } })
  fireEvent.click(screen.getByRole("button", { name: "Crear" }))

  await waitFor(() =>
    expect(save).toHaveBeenCalledWith("habits", expect.objectContaining({ period: "week" })),
  )
})
