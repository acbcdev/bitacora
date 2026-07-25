import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { Review } from "@/pages/review"

// Spy hoisted para poder referenciarlo dentro del factory de vi.mock.
const { insertReadLog } = vi.hoisted(() => ({
  insertReadLog: vi.fn(() => Promise.resolve({ error: null })),
}))

// Mock del cliente Supabase: cola de 2 notas + un curso. Sin red.
vi.mock("@/lib/supabase", () => {
  const rows: Record<string, unknown[]> = {
    courses: [{ id: "c1", name: "Curso", status: "active", created_at: "2026-01-01" }],
    notes: [],
    read_log: [],
  }
  // Cadena thenable: select/is/eq/order devuelven la misma cadena y se resuelven al await —
  // igual que el PostgrestBuilder real de supabase-js, que también es un thenable.
  const query = (table: string) => {
    const chain = {
      select: () => chain,
      is: () => chain,
      eq: () => chain,
      order: () => chain,
      insert: insertReadLog,
      // oxlint-disable-next-line unicorn/no-thenable -- es justamente lo que imita al builder real
      then: (fn: (r: unknown) => unknown) =>
        Promise.resolve({ data: rows[table] ?? [], error: null }).then(fn),
    }
    return chain
  }
  return {
    supabase: {
      rpc: (name: string) =>
        Promise.resolve({
          data:
            name === "review_queue"
              ? [
                  { id: "n1", title: "Nota uno", content: { type: "doc" }, course_id: "c1" },
                  { id: "n2", title: "Nota dos", content: { type: "doc" }, course_id: "c1" },
                ]
              : [],
          error: null,
        }),
      from: query,
    },
  }
})

// Tiptap no corre limpio en jsdom y no es lo que testeamos acá.
vi.mock("@/components/editor", () => ({ Editor: () => <div data-testid="editor" /> }))

function renderReview() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Review />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => insertReadLog.mockClear())

test("J/K saltan sin tocar read_log; Space inserta una fila y avanza", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  // J = saltar sin contar → avanza, no inserta.
  fireEvent.keyDown(window, { key: "j" })
  await screen.findByText("Nota dos")
  // K = volver sin contar.
  fireEvent.keyDown(window, { key: "k" })
  await screen.findByText("Nota uno")
  expect(insertReadLog).not.toHaveBeenCalled()

  // Space = marcar leído (exactamente 1 insert) + avanzar.
  fireEvent.keyDown(window, { key: " " })
  await waitFor(() => expect(insertReadLog).toHaveBeenCalledTimes(1))
  expect(insertReadLog).toHaveBeenCalledWith({ note_id: "n1" })
  await screen.findByText("Nota dos")
})
