import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { Notebooks } from "@/notebooks/notebooks"

// Estado mutable para poder variar la cantidad de notebooks entre tests (mismo patrón que
// notebook.test.tsx).
const { state } = vi.hoisted(() => ({
  state: {
    notebooks: [
      { id: "c1", name: "Notebook móvil", status: "active", created_at: "2026-01-01" },
    ] as unknown[],
  },
}))

// El Store falso usa la derivación REAL (`derive.notebooksPage`) en vez de una reimplementación de
// la RPC escrita a mano acá. Antes este archivo tenía su propia versión en JS de la migración 0006
// — dos definiciones de "una página de notebooks" que podían divergir en silencio. Ahora hay una, y
// además tiene su propio test (core/store/derive.test.ts).
// El Store falso ya no tiene un método por query: devuelve el snapshot y la pantalla deriva. La
// derivación que corre acá es la REAL (`derive.notebooksPage`) — antes este archivo tenía su propia
// reimplementación en JS de la migración 0006, o sea dos definiciones de "página de notebooks" que
// podían divergir en silencio.
vi.mock("@/core/store", () => ({
  store: {
    snapshot: async () => ({
      notebooks: state.notebooks,
      notes: [],
      reads: [],
      habits: [],
      habitLog: [],
    }),
  },
}))

function renderNotebooks() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TooltipProvider>
          <Notebooks />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// Con Routes: para poder observar a dónde navega Enter (mismo patrón que notebook.test.tsx).
function renderNotebooksWithRoutes() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/notebooks"]}>
        <TooltipProvider>
          <Routes>
            <Route path="/notebooks" element={<Notebooks />} />
            <Route path="/notebook/:id" element={<p>Detalle de notebook</p>} />
          </Routes>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// use-mobile.ts decide por window.innerWidth (ver src/test/setup.ts).
function setWidth(px: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: px })
  window.dispatchEvent(new Event("resize"))
}

beforeEach(() => {
  state.notebooks = [
    { id: "c1", name: "Notebook móvil", status: "active", created_at: "2026-01-01" },
  ]
})

afterEach(() => setWidth(1024))

test("en viewport angosto la vista tabla no se renderiza, quedan las cards", async () => {
  setWidth(375)
  renderNotebooks()
  expect(await screen.findByText("Notebook móvil")).toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
})

test("la vista default es cards y en desktop el toggle cambia a tabla", async () => {
  setWidth(1024)
  renderNotebooks()
  expect(await screen.findByText("Notebook móvil")).toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole("radio", { name: "tabla" }))
  expect(screen.getByRole("table")).toBeInTheDocument()
})

test("J/K mueven la selección y Enter navega al notebook seleccionado", async () => {
  state.notebooks = [
    { id: "c1", name: "Notebook uno", status: "active", created_at: "2026-01-01" },
    { id: "c2", name: "Notebook dos", status: "active", created_at: "2026-01-02" },
  ]
  const { container } = renderNotebooksWithRoutes()
  await screen.findByText("Notebook uno")

  // El sort "recientes" desempata por created_at desc en la RPC — "Notebook dos" (2026-01-02) queda
  // primero que "Notebook uno" (2026-01-01), sin repasos que cambien el orden acá.
  expect(container.querySelector('[data-active="true"]')?.textContent).toContain("Notebook dos")

  fireEvent.keyDown(document, { code: "KeyK" })
  expect(container.querySelector('[data-active="true"]')?.textContent).toContain("Notebook uno")

  fireEvent.keyDown(document, { code: "Enter" })
  await screen.findByText("Detalle de notebook")
})

test("E abre el form de editar el notebook seleccionado", async () => {
  renderNotebooks()
  await screen.findByText("Notebook móvil")

  fireEvent.keyDown(document, { code: "KeyE" })
  await screen.findByText("Editar notebook")
})

test("Delete abre la confirmación de borrado del notebook seleccionado", async () => {
  renderNotebooks()
  await screen.findByText("Notebook móvil")

  fireEvent.keyDown(document, { code: "Backspace" })
  await screen.findByText("¿Borrar “Notebook móvil”?")
})

test('"/" enfoca el buscador', async () => {
  renderNotebooks()
  await screen.findByText("Notebook móvil")

  const search = screen.getByPlaceholderText("Buscar notebook…")
  expect(search).not.toHaveFocus()
  fireEvent.keyDown(document, { code: "Slash" })
  expect(search).toHaveFocus()
})

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    // created_at desc = "Notebook 0" primero, para que el orden de render sea el del índice.
    name: `Notebook ${i}`,
    status: "active",
    created_at: `2026-01-${String(n - i).padStart(2, "0")}`,
  }))

test("la página trae 24 filas y Siguiente pide la que sigue", async () => {
  state.notebooks = many(30)
  renderNotebooks()
  await screen.findByText("Notebook 0")

  expect(screen.queryByText("Notebook 24")).toBeNull()
  fireEvent.click(screen.getByRole("link", { name: "Go to next page" }))

  await screen.findByText("Notebook 24")
  expect(screen.queryByText("Notebook 0")).toBeNull()
})

test("ir a la página 2 y volver por número", async () => {
  state.notebooks = many(30)
  renderNotebooks()
  await screen.findByText("Notebook 0")

  fireEvent.click(screen.getByRole("link", { name: "2" }))
  await screen.findByText("Notebook 24")

  fireEvent.click(screen.getByRole("link", { name: "1" }))
  await screen.findByText("Notebook 0")
})

test("buscar vuelve a la página 1 y el total sale del server", async () => {
  state.notebooks = many(30)
  renderNotebooks()
  await screen.findByText("Notebook 0")
  expect(screen.getByText("30 notebooks")).toBeInTheDocument()

  fireEvent.click(screen.getByRole("link", { name: "2" }))
  await screen.findByText("Notebook 24")

  // El debounce del buscador es de 300ms; findBy* espera hasta 1s.
  fireEvent.change(screen.getByPlaceholderText("Buscar notebook…"), {
    target: { value: "Notebook 1" },
  })
  await screen.findByText("11 notebooks") // Notebook 1 + Notebook 10..19
  expect(screen.queryByRole("navigation", { name: "pagination" })).toBeNull()
})

test("Enter en el buscador dispara la búsqueda sin esperar el debounce", async () => {
  state.notebooks = many(30)
  renderNotebooks()
  await screen.findByText("Notebook 0")

  const search = screen.getByPlaceholderText("Buscar notebook…")
  fireEvent.change(search, { target: { value: "Notebook 1" } })
  fireEvent.keyDown(search, { key: "Enter" })
  await screen.findByText("11 notebooks")
})

test("sin resultados muestra el vacío de filtros", async () => {
  renderNotebooks()
  await screen.findByText("Notebook móvil")

  fireEvent.change(screen.getByPlaceholderText("Buscar notebook…"), { target: { value: "zzz" } })
  await screen.findByText("Sin notebooks que coincidan.")
})
