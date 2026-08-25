import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { Course } from "@/courses/course"

// Latencia de cada SELECT. Alta a propósito y muy por encima del polling de waitFor (50ms): es lo
// que distingue "navegó con lo que ya tenía" de "esperó un roundtrip más" (ADR 0008).
const SELECT_MS = 400

const { state } = vi.hoisted(() => ({
  state: {
    notes: [
      { id: "n1", title: "Nota 1", content: { type: "doc" }, course_id: "c1", position: 0 },
    ] as Record<string, unknown>[],
  },
}))

// Las lecturas tardan SELECT_MS; la escritura responde ya, como en la vida real. Con el seam esto
// son seis funciones async — antes era un thenable a mano imitando el builder de supabase-js.
const slow = <T,>(value: T) => new Promise<T>((r) => setTimeout(() => r(value), SELECT_MS))

vi.mock("@/core/store", () => ({
  store: {
    canGenerateFlashcards: true,
    listCourses: () =>
      slow([{ id: "c1", name: "Curso", status: "active", created_at: "2026-01-01" }]),
    listNotes: () => slow(state.notes.map((n) => ({ ...n }))),
    listNoteRefs: () => slow(state.notes.map((n) => ({ ...n }))),
    getNote: (id: string) => slow(state.notes.find((n) => n.id === id)),
    readLog: () => slow([]),
    gradedReads: () => slow([]),
    createNote: (courseId: string, position: number) => {
      const row = { id: "n2", course_id: courseId, position, title: "", content: { type: "doc" } }
      state.notes.push(row)
      return Promise.resolve(row)
    },
    updateNote: () => Promise.resolve(),
  },
}))

vi.mock("@/core/components/editor", () => ({ Editor: () => <div data-testid="editor" /> }))

function NoteIdProbe() {
  const { noteId } = useParams()
  return <div data-testid="note-id">{noteId}</div>
}

function renderCourse() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/course/c1"]}>
        <TooltipProvider>
          <Routes>
            {["/course/:id", "/course/:id/:noteId"].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <>
                    <NoteIdProbe />
                    <Course focus={false} setFocus={() => {}} />
                  </>
                }
              />
            ))}
          </Routes>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test("`n` abre la nota nueva sin esperar ningún SELECT, y no rebota a la primera", async () => {
  renderCourse()
  await waitFor(() => expect(screen.getByTestId("note-id")).toHaveTextContent("n1"))

  const t0 = Date.now()
  fireEvent.keyDown(document, { key: "n", code: "KeyN" })
  await waitFor(() => expect(screen.getByTestId("note-id")).toHaveTextContent("n2"))

  // Falla si alguien devuelve la promesa del invalidateQueries (el navigate se cuelga del refetch)
  // o si vuelve el SELECT del último position.
  expect(Date.now() - t0).toBeLessThan(SELECT_MS)
  // El editor monta con la nota sembrada en cache, no con el skeleton de useNote.
  expect(screen.getByTestId("editor")).toBeInTheDocument()

  // Cuando aterriza el refetch de fondo, la URL sigue en la nota nueva: sin sembrar la lista, el
  // efecto de auto-corrección de Course rebota a la primera nota del curso.
  await new Promise((r) => setTimeout(r, SELECT_MS * 2))
  expect(screen.getByTestId("note-id")).toHaveTextContent("n2")
})
