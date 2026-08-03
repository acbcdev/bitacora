import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { Review } from "@/review/review"

// Spy hoisted para poder referenciarlo dentro del factory de vi.mock.
const { insertReadLog } = vi.hoisted(() => ({
  insertReadLog: vi.fn(() => Promise.resolve({ error: null })),
}))

// Mock del cliente Supabase: cola de 2 notas + un curso. Sin red.
vi.mock("@/core/lib/supabase", () => {
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
                  {
                    id: "n1",
                    title: "Nota uno",
                    content: { type: "doc" },
                    course_id: "c1",
                    kind: "note",
                  },
                  {
                    id: "n2",
                    title: "Nota dos",
                    content: { type: "doc" },
                    course_id: "c1",
                    kind: "note",
                  },
                  {
                    id: "f1",
                    title: "Pregunta uno",
                    content: { type: "doc" },
                    course_id: "c1",
                    kind: "flashcard",
                  },
                ]
              : [],
          error: null,
        }),
      from: query,
    },
  }
})

// Tiptap no corre limpio en jsdom y no es lo que testeamos acá.
vi.mock("@/core/components/editor", () => ({ Editor: () => <div data-testid="editor" /> }))

function renderReview() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        {/* Hoy embebe Cursos, y ahí hay tooltips: sin provider radix tira. En la app real lo pone
            App una sola vez. */}
        <TooltipProvider>
          <Review />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => insertReadLog.mockClear())

test("J/K saltan sin tocar read_log; Space inserta una fila y avanza", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  // K = saltar sin contar → avanza, no inserta.
  // react-hotkeys-hook matchea por e.code y escucha en `document`, no `window`.
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Nota dos")
  // J = volver sin contar.
  fireEvent.keyDown(document, { code: "KeyJ" })
  await screen.findByText("Nota uno")
  expect(insertReadLog).not.toHaveBeenCalled()

  // Space = marcar leído (exactamente 1 insert) + avanzar.
  fireEvent.keyDown(document, { code: "Space" })
  await waitFor(() => expect(insertReadLog).toHaveBeenCalledTimes(1))
  expect(insertReadLog).toHaveBeenCalledWith({ note_id: "n1", grade: undefined })
  await screen.findByText("Nota dos")
})

test("cola mixta: la flashcard se renderiza distinto y gradearla inserta el grade y avanza", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  // K saltea sin insertar, sin importar el kind del ítem al que se llega.
  fireEvent.keyDown(document, { code: "KeyK" })
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Pregunta uno")
  expect(insertReadLog).not.toHaveBeenCalled()

  // J también saltea sin insertar estando parado en una flashcard.
  fireEvent.keyDown(document, { code: "KeyJ" })
  await screen.findByText("Nota dos")
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Pregunta uno")
  expect(insertReadLog).not.toHaveBeenCalled()

  // Antes de revelar: sin botones de grade, solo "Revelar respuesta" (distinto de una nota).
  expect(screen.queryByRole("button", { name: "Marcar leído" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Correcto" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Revelar respuesta" }))

  fireEvent.click(screen.getByRole("button", { name: "Correcto" }))
  await waitFor(() => expect(insertReadLog).toHaveBeenCalledTimes(1))
  expect(insertReadLog).toHaveBeenCalledWith({ note_id: "f1", grade: "correcto" })
  // Única flashcard de la cola (3 ítems) → avanza y termina el batch.
  await screen.findByText("Batch terminado.")
})

test("click en el card de una nota abre el dialog con la nota completa; cerrarlo lo saca", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  expect(screen.queryByTestId("editor")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  await screen.findByTestId("editor")

  // Ya no hay X (showCloseButton={false}): cerrar es Esc o click afuera, default de Radix.
  fireEvent.keyDown(document, { key: "Escape" })
  await waitFor(() => expect(screen.queryByTestId("editor")).not.toBeInTheDocument())
})

test("Marcar leído funciona desde el card sin abrir el dialog", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  fireEvent.click(screen.getByRole("button", { name: "Marcar leído" }))
  await waitFor(() => expect(insertReadLog).toHaveBeenCalledTimes(1))
  expect(insertReadLog).toHaveBeenCalledWith({ note_id: "n1", grade: undefined })
  await screen.findByText("Nota dos")
})

test("Marcar leído también funciona desde adentro del dialog, y lo cierra", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  const dialog = await screen.findByRole("dialog")
  fireEvent.click(within(dialog).getByRole("button", { name: "Marcar leído" }))

  await waitFor(() => expect(insertReadLog).toHaveBeenCalledTimes(1))
  expect(insertReadLog).toHaveBeenCalledWith({ note_id: "n1", grade: undefined })
  await screen.findByText("Nota dos")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
