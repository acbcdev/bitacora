import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { Course } from "@/courses/course"

const { insertNotes, invokeFn, state } = vi.hoisted(() => ({
  insertNotes: vi.fn((_input: unknown) => Promise.resolve({ error: null })),
  invokeFn: vi.fn(() =>
    Promise.resolve({
      data: {
        flashcards: [
          { question: "¿Qué es X?", answer: "Es Y" },
          { question: "¿Qué es Z?", answer: "Es W" },
        ],
      },
      error: null,
    }),
  ),
  state: {
    notes: [
      { id: "n1", title: "Nota 1", content: { type: "doc" }, course_id: "c1", position: 0 },
    ] as unknown[],
  },
}))

// Mock del cliente Supabase + Edge Function: un curso con (o sin, según el test) notas.
vi.mock("@/core/lib/supabase", () => {
  const rows: Record<string, unknown[]> = {
    courses: [{ id: "c1", name: "Curso", status: "active", created_at: "2026-01-01" }],
    read_log: [],
  }
  const query = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      order: () => chain,
      insert: (input: unknown) => {
        insertNotes(input)
        return Promise.resolve({ error: null })
      },
      // oxlint-disable-next-line unicorn/no-thenable -- imita al builder real de supabase-js
      then: (fn: (r: unknown) => unknown) =>
        Promise.resolve({
          data: table === "notes" ? state.notes : (rows[table] ?? []),
          error: null,
        }).then(fn),
    }
    return chain
  }
  return {
    supabase: {
      from: query,
      functions: { invoke: invokeFn },
    },
  }
})

vi.mock("@/core/components/editor", () => ({ Editor: () => <div data-testid="editor" /> }))

function renderCourse() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/course/c1"]}>
        <TooltipProvider>
          <Routes>
            <Route path="/course/:id" element={<Course />} />
          </Routes>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  insertNotes.mockClear()
  invokeFn.mockClear()
  state.notes = [
    { id: "n1", title: "Nota 1", content: { type: "doc" }, course_id: "c1", position: 0 },
  ]
})

test("Generar flashcards invoca la edge function e inserta cada par como nota kind: flashcard", async () => {
  renderCourse()
  await screen.findByText("Curso")

  fireEvent.click(screen.getByRole("button", { name: /Generar flashcards/ }))

  await waitFor(() =>
    expect(invokeFn).toHaveBeenCalledWith("generate-flashcards", { body: { course_id: "c1" } }),
  )
  await waitFor(() => expect(insertNotes).toHaveBeenCalledTimes(1))
  const inserted = insertNotes.mock.calls[0][0] as { kind: string; title: string }[]
  expect(inserted).toHaveLength(2)
  expect(inserted.every((n) => n.kind === "flashcard")).toBe(true)
  expect(inserted.map((n) => n.title)).toEqual(["¿Qué es X?", "¿Qué es Z?"])
})

test("el botón queda deshabilitado si el curso no tiene notas", async () => {
  state.notes = []
  renderCourse()
  await screen.findByText("Curso")

  expect(screen.getByRole("button", { name: /Generar flashcards/ })).toBeDisabled()
})
