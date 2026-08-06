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

// Mock del cliente Supabase.
vi.mock("@/core/lib/supabase", () => {
  const query = (table: string) => {
    const chain = {
      select: () => chain,
      is: () => chain,
      eq: () => chain,
      order: () => chain,
      // oxlint-disable-next-line unicorn/no-thenable -- imita al builder real de supabase-js
      then: (fn: (r: unknown) => unknown) =>
        Promise.resolve({
          data: table === "courses" ? state.courses : [],
          error: null,
        }).then(fn),
    }
    return chain
  }
  return {
    supabase: { from: query, rpc: () => Promise.resolve({ data: [], error: null }) },
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

  // useCourses() ya ordena por created_at desc (courses.api.ts) — "Curso dos" (2026-01-02) queda
  // primero que "Curso uno" (2026-01-01), sin repasos que cambien el sort "recientes" acá.
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
