import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { Review } from "@/review/review"
import { course, habit, note, renderApp } from "@/test/harness"
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
    courses: [course({ id: "c1", name: "Curso", status: "active", created_at: "2026-01-01" })],
    notes: [
      note({
        id: "n1",
        title: "Nota uno",
        course_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:01Z",
      }),
      note({
        id: "n2",
        title: "Nota dos",
        course_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:02Z",
      }),
      note({
        id: "f1",
        title: "Pregunta uno",
        course_id: "c1",
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

test("J/K delegan sin tocar read_log", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Nota dos")
  fireEvent.keyDown(document, { code: "KeyJ" })
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
  expect(screen.getByText("2 / 3")).toBeInTheDocument()
})

test("Flashcard Enter revela y Correcto idempotente sin avanzar", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "KeyK" })
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Pregunta uno")
  expect(screen.queryByTestId("editor")).not.toBeInTheDocument()
  fireEvent.keyDown(document, { code: "Enter" })
  await screen.findByTestId("editor")
  fireEvent.click(screen.getByRole("button", { name: "Correcto" }))
  await waitFor(async () => expect((await store.snapshot()).reads).toHaveLength(1))
  expect(screen.getByRole("button", { name: "Correcto" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Correcto" }))
  expect((await store.snapshot()).reads).toHaveLength(1)
  expect(await screen.findByText("Pregunta uno")).toBeInTheDocument()
})

test("Cargar más descongela: trae el 4to tras marcar", async () => {
  const { store } = renderReview({
    notes: [
      note({
        id: "n1",
        title: "Nota uno",
        course_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:01Z",
      }),
      note({
        id: "n2",
        title: "Nota dos",
        course_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:02Z",
      }),
      note({
        id: "n3",
        title: "Nota tres",
        course_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:03Z",
      }),
      note({
        id: "n4",
        title: "Nota cuatro",
        course_id: "c1",
        position: 0,
        kind: "note",
        created_at: "2026-01-01T00:00:04Z",
      }),
    ] as unknown as Snapshot["notes"],
  })
  await screen.findByText("Nota uno")
  expect(screen.getByText("1 / 3")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", { name: "Leído y siguiente" }),
  )
  await screen.findByText("Nota dos")
  expect((await store.snapshot()).reads).toHaveLength(1)
  expect(screen.getByText("2 / 3")).toBeInTheDocument()
  expect(screen.queryByText("Nota cuatro")).not.toBeInTheDocument()
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Nota tres")
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Batch terminado.")
  fireEvent.click(screen.getByRole("button", { name: "Cargar más" }))
  await screen.findByText("Nota dos")
  expect(screen.getByText("1 / 3")).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText("Nota dos")).toBeInTheDocument())
  expect(await screen.findByText("Nota dos")).toBeInTheDocument()
})

test("con ConfirmDelete abierto, Enter no queda capturado por Repaso", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "KeyK" })
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Pregunta uno")
  fireEvent.click(screen.getByRole("button", { name: "Revelar respuesta" }))
  fireEvent.click(screen.getByRole("button", { name: "Borrar flashcard" }))
  await screen.findByRole("alertdialog")
  const notPrevented = fireEvent.keyDown(document, { code: "Enter" })
  expect(notPrevented).toBe(true)
  expect((await store.snapshot()).reads).toHaveLength(0)
})
