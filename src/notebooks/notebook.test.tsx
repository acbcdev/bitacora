import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { Notebook } from "@/notebooks/notebook"

const { generateFlashcards, softDelete, state } = vi.hoisted(() => ({
  generateFlashcards: vi.fn(() => Promise.resolve()),
  softDelete: vi.fn(() => Promise.resolve()),
  state: {
    notes: [
      {
        id: "n1",
        title: "Nota 1",
        content: { type: "doc" },
        notebook_id: "c1",
        kind: "note",
        position: 0,
        created_at: "2026-01-01",
      },
    ] as Record<string, unknown>[],
    reads: [] as { note_id: string; read_at: string; grade: string | null }[],
  },
}))

// Store falso: un notebook con (o sin, según el test) notas. Con el seam angosto es un snapshot y
// tres escrituras — antes era un builder de supabase-js imitado a mano.
vi.mock("@/core/store", () => ({
  store: {
    canGenerateFlashcards: true,
    snapshot: async () => ({
      notebooks: [{ id: "c1", name: "Notebook", status: "active", created_at: "2026-01-01" }],
      notes: state.notes,
      reads: state.reads,
      habits: [],
      habitLog: [],
    }),
    note: async (id: string) => state.notes.find((n) => n.id === id),
    save: async () => {},
    softDelete,
    generateFlashcards,
  },
}))

vi.mock("@/core/components/editor", () => ({ Editor: () => <div data-testid="editor" /> }))

function renderNotebook() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/notebook/c1"]}>
        <TooltipProvider>
          <Routes>
            <Route path="/notebook/:id" element={<Notebook focus={false} setFocus={() => {}} />} />
            <Route
              path="/notebook/:id/:noteId"
              element={<Notebook focus={false} setFocus={() => {}} />}
            />
          </Routes>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  generateFlashcards.mockClear()
  softDelete.mockClear()
  state.reads = []
  state.notes = [
    {
      id: "n1",
      title: "Nota 1",
      content: { type: "doc" },
      notebook_id: "c1",
      kind: "note",
      created_at: "2026-01-01",
      position: 0,
    },
  ]
})

// Radix abre el menú con pointerdown, no con click; en jsdom es más estable dispararlo por
// teclado (Enter en el trigger), que es el mismo camino que usa alguien navegando con tab.
function openNotebookMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Acciones del notebook" }), { key: "Enter" })
}

// Qué se afirma acá cambió con el seam: que el menú dispara la operación del dominio para ESTE
// notebook. Que un par pregunta/respuesta se guarde como `kind: 'flashcard'` (ADR 0010) es interno
// del adapter de Supabase — la Edge Function no existe del lado local.
test("Generar flashcards dispara la generación para el notebook abierto", async () => {
  renderNotebook()
  await screen.findByText("Notebook")

  openNotebookMenu()
  fireEvent.click(await screen.findByRole("menuitem", { name: /Generar flashcards/ }))

  await waitFor(() => expect(generateFlashcards).toHaveBeenCalledWith("c1"))
})

// Borrar es soft delete (deleted_at, ADR 0002) y va detrás de una confirmación: el menú se
// desmonta al elegir el item, así que el AlertDialog vive fuera del DropdownMenu.
test("Borrar notebook pide confirmación antes de tocar la DB", async () => {
  renderNotebook()
  await screen.findByText("Notebook")

  openNotebookMenu()
  fireEvent.click(await screen.findByRole("menuitem", { name: /Borrar notebook/ }))
  await screen.findByRole("alertdialog")
  expect(softDelete).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: "Borrar" }))
  await waitFor(() => expect(softDelete).toHaveBeenCalledWith("notebooks", "c1"))
})

test("Editar notebook abre el form con los datos del notebook", async () => {
  renderNotebook()
  await screen.findByText("Notebook")

  openNotebookMenu()
  fireEvent.click(await screen.findByRole("menuitem", { name: /Editar notebook/ }))

  await screen.findByRole("dialog")
  expect(screen.getByLabelText("Nombre")).toHaveValue("Notebook")
})

// En mobile los dos paneles se apilan (índice arriba, nota abajo): elegir del índice tiene que
// llevarte a la nota, si no el tap parece no hacer nada.
test("en mobile, elegir una nota del índice scrollea al panel de la nota", async () => {
  state.notes = [
    {
      id: "n1",
      title: "Nota 1",
      content: { type: "doc" },
      notebook_id: "c1",
      kind: "note",
      created_at: "2026-01-01",
      position: 0,
    },
    {
      id: "n2",
      title: "Nota 2",
      content: { type: "doc" },
      notebook_id: "c1",
      kind: "note",
      created_at: "2026-01-01",
      position: 1,
    },
  ]
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 375 })
  const scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView

  renderNotebook()
  fireEvent.click(await screen.findByRole("button", { name: /Nota 2/ }))

  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" })
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 })
})

test("el botón queda deshabilitado si el notebook no tiene notas", async () => {
  state.notes = []
  renderNotebook()
  await screen.findByText("Notebook")

  openNotebookMenu()
  expect(await screen.findByRole("menuitem", { name: /Generar flashcards/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  )
})

// mod+j / mod+k: alias forzado (enableOnContentEditable) para navegar entre notas con el foco
// adentro del editor — j,k solos se desactivan ahí por default de la lib. ctrlKey: true porque
// jsdom reporta un userAgent sin "mac", así que "mod" resuelve a ctrlKey acá, no metaKey.
test("mod+k / mod+j mueven entre notas del notebook", async () => {
  state.notes = [
    {
      id: "n1",
      title: "Nota 1",
      content: { type: "doc" },
      notebook_id: "c1",
      kind: "note",
      created_at: "2026-01-01",
      position: 0,
    },
    {
      id: "n2",
      title: "Nota 2",
      content: { type: "doc" },
      notebook_id: "c1",
      kind: "note",
      created_at: "2026-01-01",
      position: 1,
    },
  ]
  const { container } = renderNotebook()
  await screen.findByText("Nota 1")

  fireEvent.keyDown(document, { code: "KeyK", ctrlKey: true })
  await waitFor(() =>
    expect(container.querySelector('[data-active="true"]')?.textContent).toContain("Nota 2"),
  )

  fireEvent.keyDown(document, { code: "KeyJ", ctrlKey: true })
  await waitFor(() =>
    expect(container.querySelector('[data-active="true"]')?.textContent).toContain("Nota 1"),
  )
})

// Variant E: la celda derecha de cada fila muestra frescura (días desde el último repaso) y queda
// vacía para las nunca repasadas — el diagnóstico de "¿qué hace cuánto que no repaso?" es el
// trabajo del sidebar, el repaso en sí vive en Home/Repaso.
test("el índice muestra frescura por nota y celda vacía para las nunca repasadas", async () => {
  state.notes = [
    {
      id: "n1",
      title: "Recién",
      content: { type: "doc" },
      notebook_id: "c1",
      kind: "note",
      created_at: "2026-01-01",
      position: 0,
    },
    {
      id: "n2",
      title: "Nunca",
      content: { type: "doc" },
      notebook_id: "c1",
      kind: "note",
      created_at: "2026-01-01",
      position: 1,
    },
  ]
  // Relativo al now real: la frescura se calcula contra Date.now(), no contra un now inyectado.
  state.reads = [
    { note_id: "n1", read_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), grade: null },
  ]
  renderNotebook()
  expect(await screen.findByText("hace 2d")).toBeInTheDocument()
  // Sin repaso no hay rótulo: la celda existe pero vacía, no "sin leer".
  expect(screen.queryByText(/sin leer/)).not.toBeInTheDocument()
})

test("la búsqueda filtra el índice por título", async () => {
  state.notes = [
    {
      id: "n1",
      title: "Sesgo cognitivo",
      content: { type: "doc" },
      notebook_id: "c1",
      kind: "note",
      created_at: "2026-01-01",
      position: 0,
    },
    {
      id: "n2",
      title: "Falacia naturalista",
      content: { type: "doc" },
      notebook_id: "c1",
      kind: "note",
      created_at: "2026-01-01",
      position: 1,
    },
  ]
  renderNotebook()
  await screen.findByText("Falacia naturalista")

  fireEvent.change(screen.getByPlaceholderText("Buscar nota…"), { target: { value: "sesgo" } })
  expect(screen.getAllByText("Sesgo cognitivo").length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByText("Falacia naturalista")).not.toBeInTheDocument())
})

// El menú por nota (NoteActions) vive en la fila: el trigger abre, las acciones ya se testean en
// note-actions.test.tsx.
test("el menú ⋯ de la fila abre las acciones de la nota", async () => {
  renderNotebook()
  await screen.findByText("Nota 1")

  fireEvent.keyDown(screen.getAllByRole("button", { name: "Acciones de la nota" })[0], {
    key: "Enter",
  })
  expect(await screen.findByRole("menuitem", { name: "Focus" })).toBeInTheDocument()
})
