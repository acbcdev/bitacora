import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { HabitsDialog } from "@/habits/habits-dialog"
import type { Habit } from "@/core/types/database"
import type { Snapshot } from "@/core/store/types"

const { save, softDelete, state } = vi.hoisted(() => ({
  save: vi.fn((_entity: string, _input: unknown) => Promise.resolve()),
  softDelete: vi.fn((_entity: string, _id: string) => Promise.resolve()),
  state: { habits: [] as Habit[] },
}))

vi.mock("@/core/store", () => ({
  store: {
    snapshot: async (): Promise<Snapshot> => ({
      notebooks: [],
      notes: [],
      reads: [],
      habits: state.habits,
      habitLog: [],
    }),
    save,
    softDelete,
  },
}))

const habit = (id: string, name: string, over: Partial<Habit> = {}): Habit => ({
  id,
  user_id: "u1",
  name,
  icon: null,
  kind: "good",
  metric: "count",
  target: 3,
  period: "week",
  days: null,
  tracks: null,
  deleted_at: null,
  created_at: `2026-01-0${id.slice(1)}T12:00:00Z`,
  ...over,
})

function renderDialog(startNew = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <HabitsDialog startNew={startNew} onClose={vi.fn()} />
    </QueryClientProvider>,
  )
}

const title = () => (screen.getByLabelText("Nombre") as HTMLInputElement).value
const altKey = (code: "KeyJ" | "KeyK", target: Element = document.activeElement ?? document.body) =>
  fireEvent.keyDown(target, { code, altKey: true })

beforeEach(() => {
  save.mockClear()
  softDelete.mockClear()
  state.habits = [habit("h1", "Read"), habit("h2", "Gym"), habit("h3", "Meditar")]
})

test("abre con el primero seleccionado y click en la lista cambia el detalle", async () => {
  renderDialog()
  await waitFor(() => expect(title()).toBe("Read"))
  fireEvent.click(screen.getByRole("option", { name: /Gym/ }))
  expect(title()).toBe("Gym")
  expect(screen.getByRole("option", { name: /Gym/ })).toHaveAttribute("aria-selected", "true")
})

test("⌥J / ⌥K mueven la selección desde el input y no dan la vuelta", async () => {
  renderDialog()
  await waitFor(() => expect(title()).toBe("Read"))
  const input = screen.getByLabelText("Nombre")
  altKey("KeyK", input)
  expect(title()).toBe("Read")
  altKey("KeyJ", input)
  expect(title()).toBe("Gym")
  altKey("KeyJ", screen.getByLabelText("Nombre"))
  altKey("KeyJ", screen.getByLabelText("Nombre"))
  expect(title()).toBe("Meditar")
  altKey("KeyK", screen.getByLabelText("Nombre"))
  expect(title()).toBe("Gym")
})

test("↑ / ↓ mueven la selección sin foco en la lista", async () => {
  renderDialog()
  await waitFor(() => expect(title()).toBe("Read"))
  fireEvent.keyDown(document.body, { key: "ArrowDown", code: "ArrowDown" })
  expect(title()).toBe("Gym")
  fireEvent.keyDown(document.body, { key: "ArrowUp", code: "ArrowUp" })
  expect(title()).toBe("Read")
})

test("Guardar arranca deshabilitado y al editar manda los campos nuevos", async () => {
  renderDialog()
  await waitFor(() => expect(title()).toBe("Read"))
  const guardar = screen.getByRole("button", { name: "Guardar" })
  expect(guardar).toBeDisabled()
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Leer" } })
  fireEvent.change(screen.getByLabelText("Veces"), { target: { value: "5" } })
  fireEvent.click(guardar)
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      "habits",
      expect.objectContaining({ id: "h1", name: "Leer", target: 5, period: "week" }),
    ),
  )
})

test("Cancelar resetea sin cerrar y cambiar de hábito descarta el draft", async () => {
  renderDialog()
  await waitFor(() => expect(title()).toBe("Read"))
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Leer" } })
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
  expect(title()).toBe("Read")

  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Leer" } })
  altKey("KeyJ", screen.getByLabelText("Nombre"))
  altKey("KeyK", screen.getByLabelText("Nombre"))
  expect(title()).toBe("Read")
})

test("archivar selecciona el siguiente", async () => {
  renderDialog()
  await waitFor(() => expect(title()).toBe("Read"))
  fireEvent.click(screen.getByRole("button", { name: "Archivar" }))
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Archivar" }))
  await waitFor(() => expect(softDelete).toHaveBeenCalledWith("habits", "h1"))
  expect(title()).toBe("Gym")
})

test("Nuevo muestra el form vacío y crear selecciona el nuevo", async () => {
  renderDialog()
  await waitFor(() => expect(title()).toBe("Read"))
  fireEvent.click(screen.getByRole("button", { name: "Nuevo" }))
  expect(title()).toBe("")
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Correr" } })
  save.mockImplementationOnce(async () => {
    state.habits = [...state.habits, habit("h4", "Correr")]
  })
  fireEvent.click(screen.getByRole("button", { name: "Crear" }))
  await waitFor(() =>
    expect(screen.getByRole("option", { name: /Correr/ })).toHaveAttribute("aria-selected", "true"),
  )
  expect(title()).toBe("Correr")
})

test("desde la palette abre en crear y manda period: week", async () => {
  renderDialog(true)
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Gym" } })
  fireEvent.change(screen.getByLabelText("Frecuencia"), { target: { value: "week" } })
  fireEvent.click(screen.getByRole("button", { name: "Crear" }))
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith("habits", expect.objectContaining({ period: "week" })),
  )
})

test("el graph expone un aria-label resumido", async () => {
  renderDialog()
  await waitFor(() => expect(title()).toBe("Read"))
  expect(screen.getByRole("img", { name: /^Últimas 26 semanas de Read/ })).toBeInTheDocument()
})

test("sin hábitos muestra el estado vacío con Nuevo", async () => {
  state.habits = []
  renderDialog()
  expect(await screen.findByText(/Todavía no hay hábitos/)).toBeInTheDocument()
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Nuevo" })).toBeInTheDocument()
})
