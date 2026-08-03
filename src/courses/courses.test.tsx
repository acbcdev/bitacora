import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { Courses } from "@/courses/courses"

// Mock del cliente Supabase: un curso, sin notas ni read_log.
vi.mock("@/core/lib/supabase", () => {
  const rows: Record<string, unknown[]> = {
    courses: [{ id: "c1", name: "Curso móvil", status: "active", created_at: "2026-01-01" }],
    notes: [],
    read_log: [],
  }
  const query = (table: string) => {
    const chain = {
      select: () => chain,
      is: () => chain,
      eq: () => chain,
      order: () => chain,
      // oxlint-disable-next-line unicorn/no-thenable -- imita al builder real de supabase-js
      then: (fn: (r: unknown) => unknown) =>
        Promise.resolve({ data: rows[table] ?? [], error: null }).then(fn),
    }
    return chain
  }
  return {
    supabase: { from: query, rpc: () => Promise.resolve({ data: [], error: null }) },
  }
})

function renderCourses() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TooltipProvider>
          <Courses />
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
