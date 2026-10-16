import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { Review } from "@/review/review"
import { notebook, habit, note, renderApp } from "@/test/harness"
import type { Snapshot } from "@/core/store/types"

vi.mock("@/core/store", async () => {
  const { localStore } = await import("@/core/store/local-store")
  return { store: localStore() }
})

vi.mock("@/core/components/editor", () => ({ Editor: () => <div data-testid="editor" /> }))

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
  act(() => intersectionCallback?.([{ isIntersecting: visible }]))
}

function baseSeed(over: Partial<Snapshot> = {}): Snapshot {
  return {
    notebooks: [
      notebook({ id: "c1", name: "Notebook", status: "active", created_at: "2026-01-01" }),
    ],
    notes: [
      note({
        id: "n1",
        title: "Nota uno",
        notebook_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:01Z",
      }),
      note({
        id: "n2",
        title: "Nota dos",
        notebook_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:02Z",
      }),
      note({
        id: "f1",
        title: "Pregunta uno",
        notebook_id: "c1",
        position: 0,
        kind: "flashcard",
        created_at: "2026-01-01T00:00:03Z",
      }),
    ] as unknown as Snapshot["notes"],
    reads: [],
    habits: [habit({ id: "h1", name: "Gym", metric: "count", target: 3, period: "week" })],
    habitLog: [],
    ...over,
  } as Snapshot
}

function renderReview(seed: Partial<Snapshot> = {}) {
  return renderApp(<Review />, baseSeed(seed))
}

test("←/→ delegan sin tocar read_log", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "ArrowRight" })
  await screen.findByText("Nota dos")
  fireEvent.keyDown(document, { code: "ArrowLeft" })
  await screen.findByText("Nota uno")
  expect((await store.snapshot()).reads).toHaveLength(0)
})

test("Enter abre nota sin marcar; Enter en dialog gateado a IntersectionObserver", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "Enter" })
  await screen.findByRole("dialog")
  fireEvent.keyDown(document, { code: "Enter" })
  expect((await store.snapshot()).reads).toHaveLength(0)
  markReadButtonVisible(true)
  fireEvent.keyDown(document, { code: "Enter" })
  await screen.findByText("Nota dos")
  expect((await store.snapshot()).reads).toEqual([expect.objectContaining({ note_id: "n1" })])
  expect(screen.getByText("2 / 2")).toBeInTheDocument()
})

test("Flashcard Enter revela y Correcto idempotente sin avanzar", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "ArrowRight" })
  fireEvent.keyDown(document, { code: "ArrowRight" })
  await screen.findByText("Pregunta uno")
  expect(screen.queryByTestId("editor")).not.toBeInTheDocument()
  fireEvent.keyDown(document, { code: "Enter" })
  // Historia 7: la respuesta revelada es texto simple (sin editor); la flashcard seedeada viene vacía.
  await screen.findByText("Nota sin contenido todavía.")
  fireEvent.click(screen.getByRole("button", { name: "Correcto" }))
  await waitFor(async () => expect((await store.snapshot()).reads).toHaveLength(1))
  expect(screen.getByRole("button", { name: "Correcto" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Correcto" }))
  expect((await store.snapshot()).reads).toHaveLength(1)
  expect(await screen.findByText("Pregunta uno")).toBeInTheDocument()
})

test("sesión continua: pasa de 3 sin corte, i / vistas, fin sin Cargar más", async () => {
  const { store } = renderReview({
    notes: [
      note({
        id: "n1",
        title: "Nota uno",
        notebook_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:01Z",
      }),
      note({
        id: "n2",
        title: "Nota dos",
        notebook_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:02Z",
      }),
      note({
        id: "n3",
        title: "Nota tres",
        notebook_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:03Z",
      }),
      note({
        id: "n4",
        title: "Nota cuatro",
        notebook_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:04Z",
      }),
    ] as unknown as Snapshot["notes"],
  })
  await screen.findByText("Nota uno")
  expect(screen.queryByText(/ \/ /)).toBeNull() // una sola vista: sin contador
  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", { name: "Leído y siguiente" }),
  )
  await screen.findByText("Nota dos")
  expect((await store.snapshot()).reads).toHaveLength(1)
  expect(screen.getByText("2 / 2")).toBeInTheDocument()
  fireEvent.keyDown(document, { code: "ArrowRight" })
  await screen.findByText("Nota tres")
  fireEvent.keyDown(document, { code: "ArrowRight" })
  await screen.findByText("Nota cuatro") // el 4to: ya no hay batch de 3
  expect(screen.getByText("4 / 4")).toBeInTheDocument()
  fireEvent.keyDown(document, { code: "ArrowLeft" })
  await screen.findByText("Nota tres")
  expect(screen.getByText("3 / 4")).toBeInTheDocument()
  fireEvent.keyDown(document, { code: "ArrowRight" })
  await screen.findByText("Nota cuatro")
  fireEvent.keyDown(document, { code: "ArrowRight" })
  await screen.findByText("Repasaste todo.")
  expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull()
})

test("con ConfirmDelete abierto, Enter no queda capturado por Repaso", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "ArrowRight" })
  fireEvent.keyDown(document, { code: "ArrowRight" })
  await screen.findByText("Pregunta uno")
  fireEvent.click(screen.getByRole("button", { name: "Revelar respuesta" }))
  fireEvent.click(screen.getByRole("button", { name: "Borrar flashcard" }))
  await screen.findByRole("alertdialog")
  const notPrevented = fireEvent.keyDown(document, { code: "Enter" })
  expect(notPrevented).toBe(true)
  expect((await store.snapshot()).reads).toHaveLength(0)
})

test("sin notas: invita a escribir, sin Cargar más", async () => {
  renderReview({ notes: [] })
  await screen.findByText("Sin notas todavía.")
  expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull()
})
