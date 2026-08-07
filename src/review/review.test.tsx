import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { Review } from "@/review/review"

// Spy hoisted para poder referenciarlo dentro del factory de vi.mock. El insert además guarda la
// fila en `readLog`: las stats ("leídas hoy", racha) se derivan de read_log, así que sin esto no
// se puede testear que se refresquen.
const { insertReadLog, readLog } = vi.hoisted(() => {
  const rows: unknown[] = []
  return {
    readLog: rows,
    insertReadLog: vi.fn((row: { note_id: string }) => {
      rows.push({ ...row, read_at: new Date().toISOString() })
      return Promise.resolve({ error: null })
    }),
  }
})

// Mock del cliente Supabase: cola de 2 notas + un curso. Sin red.
vi.mock("@/core/lib/supabase", () => {
  const rows: Record<string, unknown[]> = {
    courses: [{ id: "c1", name: "Curso", status: "active", created_at: "2026-01-01" }],
    notes: [],
    read_log: readLog,
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

// Mock controlable de IntersectionObserver (el de src/test/setup.ts es no-op): guarda el callback
// para poder simular "el botón Marcar leído se volvió visible" desde el test.
let intersectionCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null
class MockIntersectionObserver {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    intersectionCallback = cb
  }
  observe() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

function markReadButtonVisible(visible: boolean) {
  // El callback dispara setState fuera de un evento de React (no via fireEvent) — hay que
  // envolverlo en act() para que el render se procese antes de la siguiente aserción.
  act(() => intersectionCallback?.([{ isIntersecting: visible }]))
}

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

beforeEach(() => {
  insertReadLog.mockClear()
  readLog.length = 0
})

test("marcar leído refresca el contador de hoy", async () => {
  renderReview()
  await screen.findByText("Nota uno")
  expect(screen.getByText("leídas hoy 0/3")).toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "Marcar leído" }))
  await screen.findByText("leídas hoy 1/3")
})

test("J/K saltan sin tocar read_log; Enter abre la nota sin marcarla", async () => {
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

  // Enter con la card cerrada abre el dialog: nunca marca leído desde afuera.
  fireEvent.keyDown(document, { code: "Enter" })
  const dialog = await screen.findByRole("dialog")
  expect(insertReadLog).not.toHaveBeenCalled()
  expect(within(dialog).getByText("Nota uno")).toBeInTheDocument()
})

test("Enter dentro del dialog no marca leído hasta que el botón es visible", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  fireEvent.keyDown(document, { code: "Enter" })
  await screen.findByRole("dialog")

  // Todavía no "vimos" el botón (IntersectionObserver no disparó) → Enter no hace nada.
  fireEvent.keyDown(document, { code: "Enter" })
  expect(insertReadLog).not.toHaveBeenCalled()

  // Se vuelve visible → recién ahí Enter marca leído. No avanza: sigue en la misma nota, con el
  // botón ya en "Leído", y un segundo Enter no vuelve a insertar.
  markReadButtonVisible(true)
  fireEvent.keyDown(document, { code: "Enter" })
  await screen.findByRole("button", { name: "Leído" })
  expect(insertReadLog).toHaveBeenCalledWith({ note_id: "n1", grade: undefined })
  fireEvent.keyDown(document, { code: "Enter" })
  expect(insertReadLog).toHaveBeenCalledTimes(1)
  expect(screen.getByText("1 / 3")).toBeInTheDocument()
})

test("cola mixta: la flashcard se renderiza distinto y gradearla inserta el grade sin avanzar", async () => {
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
  // Calificar no avanza: los 3 botones quedan apagados hasta que te movés con K.
  await waitFor(() => expect(screen.getByRole("button", { name: "Correcto" })).toBeDisabled())
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Batch terminado.")
})

test("Enter revela una flashcard sin revelar", async () => {
  renderReview()
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "KeyK" })
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Pregunta uno")

  expect(screen.queryByTestId("editor")).not.toBeInTheDocument()
  fireEvent.keyDown(document, { code: "Enter" })
  await screen.findByTestId("editor")
})

test("con el diálogo de borrar flashcard abierto, Enter no queda capturado por Repaso", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  fireEvent.keyDown(document, { code: "KeyK" })
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Pregunta uno")
  fireEvent.click(screen.getByRole("button", { name: "Revelar respuesta" }))
  fireEvent.click(screen.getByRole("button", { name: "Borrar flashcard" }))
  await screen.findByRole("alertdialog")

  // enabled: !confirmingDelete → el hook de Repaso no llama preventDefault acá, así que Enter
  // sigue libre para el Cancelar/Borrar nativo del AlertDialog (fireEvent devuelve true = no
  // prevented).
  const notPrevented = fireEvent.keyDown(document, { code: "Enter" })
  expect(notPrevented).toBe(true)
  expect(insertReadLog).not.toHaveBeenCalled()
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

test("Marcar leído funciona desde el card sin abrir el dialog, y no avanza", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  fireEvent.click(screen.getByRole("button", { name: "Marcar leído" }))
  await waitFor(() => expect(insertReadLog).toHaveBeenCalledTimes(1))
  expect(insertReadLog).toHaveBeenCalledWith({ note_id: "n1", grade: undefined })
  await screen.findByRole("button", { name: "Leído" })
  expect(screen.getByText("1 / 3")).toBeInTheDocument()

  // K sigue siendo la única forma de moverse, y la nota nueva vuelve a estar sin marcar.
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Nota dos")
  expect(screen.getByRole("button", { name: "Marcar leído" })).toBeEnabled()
})

test("Marcar leído también funciona desde adentro del dialog, que queda abierto", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  const dialog = await screen.findByRole("dialog")
  fireEvent.click(within(dialog).getByRole("button", { name: "Marcar leído" }))

  await waitFor(() => expect(insertReadLog).toHaveBeenCalledTimes(1))
  expect(insertReadLog).toHaveBeenCalledWith({ note_id: "n1", grade: undefined })
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Leído" })).toBeDisabled())
  expect(screen.getByRole("dialog")).toBeInTheDocument()

  // K desde adentro del dialog: avanza y lo cierra.
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Nota dos")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
