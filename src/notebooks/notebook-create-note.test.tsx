import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { Notebook } from "@/notebooks/notebook"

// Latencia de cada SELECT. Alta a propósito y muy por encima del polling de waitFor (50ms): es lo
// que distingue "navegó con lo que ya tenía" de "esperó un roundtrip más" (ADR 0008).
const SELECT_MS = 400

const note = (over: Record<string, unknown>) => ({
  title: "",
  content: { type: "doc" },
  notebook_id: "c1",
  kind: "note",
  position: 0,
  created_at: "2026-01-01",
  ...over,
})

const { state } = vi.hoisted(() => ({
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
  },
}))

// Las lecturas tardan SELECT_MS; la escritura responde ya, como en la vida real.
const slow = <T,>(value: T) => new Promise<T>((r) => setTimeout(() => r(value), SELECT_MS))

// Con el seam angosto el fake es un snapshot y dos escrituras. El `save` responde de inmediato:
// lo lento son las lecturas, que es justo lo que ADR 0008 no quiere que el navigate espere.
vi.mock("@/core/store", () => ({
  store: {
    canGenerateFlashcards: true,
    snapshot: () =>
      slow({
        notebooks: [{ id: "c1", name: "Notebook", status: "active", created_at: "2026-01-01" }],
        notes: state.notes.map((n) => ({ ...n })),
        reads: [],
        habits: [],
        habitLog: [],
      }),
    note: (id: string) => slow(state.notes.find((n) => n.id === id)),
    save: (_entity: string, input: Record<string, unknown>) => {
      if (input.id) return Promise.resolve()
      const row = { ...note(input), id: "n2" }
      state.notes.push(row)
      return Promise.resolve(row)
    },
  },
}))

vi.mock("@/core/components/editor", () => ({ Editor: () => <div data-testid="editor" /> }))

function NoteIdProbe() {
  const { noteId } = useParams()
  return <div data-testid="note-id">{noteId}</div>
}

function renderNotebook() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/notebook/c1"]}>
        <TooltipProvider>
          <Routes>
            {["/notebook/:id", "/notebook/:id/:noteId"].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <>
                    <NoteIdProbe />
                    <Notebook focus={false} setFocus={() => {}} />
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
  renderNotebook()
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
  // efecto de auto-corrección de Notebook rebota a la primera nota del notebook.
  await new Promise((r) => setTimeout(r, SELECT_MS * 2))
  expect(screen.getByTestId("note-id")).toHaveTextContent("n2")
})
