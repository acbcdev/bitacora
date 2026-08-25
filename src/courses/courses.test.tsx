import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { Courses } from "@/courses/courses"

// Estado mutable para poder variar la cantidad de cursos entre tests (mismo patrón que
// course.test.tsx).
const { state } = vi.hoisted(() => ({
  state: {
    courses: [
      { id: "c1", name: "Curso móvil", status: "active", created_at: "2026-01-01" },
    ] as unknown[],
  },
}))

// El Store falso usa la derivación REAL (`derive.coursesPage`) en vez de una reimplementación de
// la RPC escrita a mano acá. Antes este archivo tenía su propia versión en JS de la migración 0006
// — dos definiciones de "una página de cursos" que podían divergir en silencio. Ahora hay una, y
// además tiene su propio test (core/store/derive.test.ts).
vi.mock("@/core/store", async () => {
  const { coursesPage } = await import("@/core/store/derive")
  type Query = Parameters<typeof coursesPage>[3]
  return {
    store: {
      listCourses: async () => state.courses,
      coursesPage: async (query: Query) => coursesPage(state.courses as never, [], [], query),
      listNoteRefs: async () => [],
      readLog: async () => [],
      gradedReads: async () => [],
    },
  }
})

function renderCourses() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TooltipProvider>
          <Courses />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// Con Routes: para poder observar a dónde navega Enter (mismo patrón que course.test.tsx).
function renderCoursesWithRoutes() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/courses"]}>
        <TooltipProvider>
          <Routes>
            <Route path="/courses" element={<Courses />} />
            <Route path="/course/:id" element={<p>Detalle de curso</p>} />
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
  state.courses = [{ id: "c1", name: "Curso móvil", status: "active", created_at: "2026-01-01" }]
})

afterEach(() => setWidth(1024))

test("en viewport angosto la vista tabla no se renderiza, quedan las cards", async () => {
  setWidth(375)
  renderCourses()
  expect(await screen.findByText("Curso móvil")).toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
})

test("la vista default es cards y en desktop el toggle cambia a tabla", async () => {
  setWidth(1024)
  renderCourses()
  expect(await screen.findByText("Curso móvil")).toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole("radio", { name: "tabla" }))
  expect(screen.getByRole("table")).toBeInTheDocument()
})

test("J/K mueven la selección y Enter navega al curso seleccionado", async () => {
  state.courses = [
    { id: "c1", name: "Curso uno", status: "active", created_at: "2026-01-01" },
    { id: "c2", name: "Curso dos", status: "active", created_at: "2026-01-02" },
  ]
  const { container } = renderCoursesWithRoutes()
  await screen.findByText("Curso uno")

  // El sort "recientes" desempata por created_at desc en la RPC — "Curso dos" (2026-01-02) queda
  // primero que "Curso uno" (2026-01-01), sin repasos que cambien el orden acá.
  expect(container.querySelector('[data-active="true"]')?.textContent).toContain("Curso dos")

  fireEvent.keyDown(document, { code: "KeyK" })
  expect(container.querySelector('[data-active="true"]')?.textContent).toContain("Curso uno")

  fireEvent.keyDown(document, { code: "Enter" })
  await screen.findByText("Detalle de curso")
})

test("E abre el form de editar el curso seleccionado", async () => {
  renderCourses()
  await screen.findByText("Curso móvil")

  fireEvent.keyDown(document, { code: "KeyE" })
  await screen.findByText("Editar curso")
})

test("Delete abre la confirmación de borrado del curso seleccionado", async () => {
  renderCourses()
  await screen.findByText("Curso móvil")

  fireEvent.keyDown(document, { code: "Backspace" })
  await screen.findByText("¿Borrar “Curso móvil”?")
})

test('"/" enfoca el buscador', async () => {
  renderCourses()
  await screen.findByText("Curso móvil")

  const search = screen.getByPlaceholderText("Buscar curso…")
  expect(search).not.toHaveFocus()
  fireEvent.keyDown(document, { code: "Slash" })
  expect(search).toHaveFocus()
})

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    // created_at desc = "Curso 0" primero, para que el orden de render sea el del índice.
    name: `Curso ${i}`,
    status: "active",
    created_at: `2026-01-${String(n - i).padStart(2, "0")}`,
  }))

test("la página trae 24 filas y Siguiente pide la que sigue", async () => {
  state.courses = many(30)
  renderCourses()
  await screen.findByText("Curso 0")

  expect(screen.queryByText("Curso 24")).toBeNull()
  fireEvent.click(screen.getByRole("link", { name: "Go to next page" }))

  await screen.findByText("Curso 24")
  expect(screen.queryByText("Curso 0")).toBeNull()
})

test("ir a la página 2 y volver por número", async () => {
  state.courses = many(30)
  renderCourses()
  await screen.findByText("Curso 0")

  fireEvent.click(screen.getByRole("link", { name: "2" }))
  await screen.findByText("Curso 24")

  fireEvent.click(screen.getByRole("link", { name: "1" }))
  await screen.findByText("Curso 0")
})

test("buscar vuelve a la página 1 y el total sale del server", async () => {
  state.courses = many(30)
  renderCourses()
  await screen.findByText("Curso 0")
  expect(screen.getByText("30 cursos")).toBeInTheDocument()

  fireEvent.click(screen.getByRole("link", { name: "2" }))
  await screen.findByText("Curso 24")

  // El debounce del buscador es de 300ms; findBy* espera hasta 1s.
  fireEvent.change(screen.getByPlaceholderText("Buscar curso…"), { target: { value: "Curso 1" } })
  await screen.findByText("11 cursos") // Curso 1 + Curso 10..19
  expect(screen.queryByRole("navigation", { name: "pagination" })).toBeNull()
})

test("Enter en el buscador dispara la búsqueda sin esperar el debounce", async () => {
  state.courses = many(30)
  renderCourses()
  await screen.findByText("Curso 0")

  const search = screen.getByPlaceholderText("Buscar curso…")
  fireEvent.change(search, { target: { value: "Curso 1" } })
  fireEvent.keyDown(search, { key: "Enter" })
  await screen.findByText("11 cursos")
})

test("sin resultados muestra el vacío de filtros", async () => {
  renderCourses()
  await screen.findByText("Curso móvil")

  fireEvent.change(screen.getByPlaceholderText("Buscar curso…"), { target: { value: "zzz" } })
  await screen.findByText("Sin cursos que coincidan.")
})
