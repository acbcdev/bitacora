import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NotebookForm } from "@/notebooks/notebook-form"
import type { Notebook } from "@/core/types/database"

const { insert, update } = vi.hoisted(() => ({
  insert: vi.fn((_input: unknown) => Promise.resolve({ error: null })),
  update: vi.fn((_input: unknown) => Promise.resolve({ error: null })),
}))

const notebooks = [
  {
    id: "c1",
    name: "Notebook 1",
    status: "active",
    source: "Platzi",
    area: "Programación",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "c2",
    name: "Notebook 2",
    status: "active",
    source: "Platzi",
    area: "Marketing",
    created_at: "2026-01-02T00:00:00Z",
  },
  {
    id: "c3",
    name: "Notebook 3",
    status: "active",
    source: null,
    area: null,
    created_at: "2026-01-03T00:00:00Z",
  },
]

// `save` es alta o edición según venga `id`. Los spies se quedan con el resto del payload, que es
// lo que estos tests afirman.
vi.mock("@/core/store", () => ({
  store: {
    snapshot: async () => ({ notebooks, notes: [], reads: [], habits: [], habitLog: [] }),
    save: (_entity: string, input: { id?: string }) => {
      const { id, ...values } = input
      return (id ? update : insert)(values)
    },
  },
}))

const notebook2: Notebook = {
  id: "c2",
  user_id: "u1",
  name: "Notebook 2",
  status: "active",
  started_at: null,
  finished_at: null,
  icon: null,
  source: "Platzi",
  area: "Marketing",
  imported: false,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00Z",
}

function renderForm(notebook: Notebook | null, onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <NotebookForm notebook={notebook} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose }
}

beforeEach(() => {
  insert.mockClear()
  update.mockClear()
})

// FieldPill (custom) abre el dropdown al enfocar el input: con focus basta.
function openCombobox(input: HTMLElement) {
  fireEvent.focus(input)
}

// El dropdown de FieldPill es `absolute` (no portaleado), así que las opciones se buscan
// con `screen` igual que antes.
test("el combobox sugiere los valores de source/area ya usados, sin duplicados", async () => {
  renderForm(null)

  openCombobox(screen.getByLabelText("Fuente"))
  // Dos notebooks comparten source "Platzi" — debe aparecer una sola vez sugerido, no duplicado.
  await waitFor(() => expect(screen.getAllByRole("option", { name: "Platzi" })).toHaveLength(1))

  fireEvent.blur(screen.getByLabelText("Fuente"))
  openCombobox(screen.getByLabelText("Área"))
  await waitFor(() => {
    expect(screen.getByRole("option", { name: "Marketing" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Programación" })).toBeInTheDocument()
  })
})

test("Enter sobre una opción la selecciona y no submittea el form", async () => {
  renderForm(null)

  const input = screen.getByLabelText("Fuente")
  openCombobox(input)
  await waitFor(() => expect(screen.getByRole("option", { name: "Platzi" })).toBeInTheDocument())

  fireEvent.keyDown(input, { key: "Enter" })
  expect(input).toHaveValue("Platzi")
  expect(insert).not.toHaveBeenCalled()
})

test("crear un notebook manda source/area tipeados en el payload", async () => {
  renderForm(null)

  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Notebook nuevo" } })
  fireEvent.change(screen.getByLabelText("Fuente"), { target: { value: "web.dev" } })
  fireEvent.change(screen.getByLabelText("Área"), { target: { value: "Inglés" } })
  fireEvent.click(screen.getByRole("button", { name: "Crear notebook" }))

  await waitFor(() =>
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ source: "web.dev", area: "Inglés" }),
    ),
  )
})

test("editar un notebook manda source/area tipeados en el payload", async () => {
  renderForm(notebook2)

  fireEvent.change(screen.getByLabelText("Fuente"), { target: { value: "Udemy" } })
  fireEvent.change(screen.getByLabelText("Área"), { target: { value: "Marketing digital" } })
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

  await waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ source: "Udemy", area: "Marketing digital" }),
    ),
  )
})

test("source/area vacíos no rompen el submit y mandan null", async () => {
  renderForm(null)

  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Notebook sin fuente" } })
  fireEvent.click(screen.getByRole("button", { name: "Crear notebook" }))

  await waitFor(() =>
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ source: null, area: null })),
  )
})
