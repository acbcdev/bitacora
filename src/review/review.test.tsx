import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { Review } from "@/review/review"
import { todayKey } from "@/core/lib/day"
import { course, habit, habitLogRow, note, renderApp } from "@/test/harness"
import type { Snapshot } from "@/core/store/types"

vi.mock("@/core/store", async () => {
  const { localStore } = await import("@/core/store/local-store")
  return { store: localStore() }
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
    habits: [
      habit({ id: "h1", name: "Gym", metric: "count", target: 3, period: "week" }),
      habit({ id: "h2", name: "Meditar", metric: "check", target: 1, period: "day" }),
      habit({ id: "h3", name: "Leer", metric: "time", target: 25, period: "day" }),
    ],
    habitLog: [],
    ...over,
  } as Snapshot
}

function renderReview(seed: Partial<Snapshot> = {}) {
  const merged = baseSeed(seed)
  return renderApp(<Review />, merged)
}

test("marcar leído refresca el contador de hoy", async () => {
  renderReview()
  await screen.findByText("Nota uno")
  expect(screen.getByText("leídas hoy 0/3")).toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  const dialog = await screen.findByRole("dialog")
  fireEvent.click(within(dialog).getByRole("button", { name: "Leído y siguiente" }))
  await screen.findByText("leídas hoy 1/3")
})

test("J/K saltan sin tocar read_log; Enter abre la nota sin marcarla", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")

  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Nota dos")
  fireEvent.keyDown(document, { code: "KeyJ" })
  await screen.findByText("Nota uno")
  expect((await store.snapshot()).reads).toHaveLength(0)

  fireEvent.keyDown(document, { code: "Enter" })
  const dialog = await screen.findByRole("dialog")
  expect((await store.snapshot()).reads).toHaveLength(0)
  expect(within(dialog).getByText("Nota uno")).toBeInTheDocument()
})

test("Enter dentro del dialog no marca leído hasta que el botón es visible", async () => {
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
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByText("2 / 3")).toBeInTheDocument()
})

test("cola mixta: la flashcard se renderiza distinto y gradearla inserta el grade sin avanzar", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")

  fireEvent.keyDown(document, { code: "KeyK" })
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Pregunta uno")
  expect((await store.snapshot()).reads).toHaveLength(0)

  fireEvent.keyDown(document, { code: "KeyJ" })
  await screen.findByText("Nota dos")
  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Pregunta uno")
  expect((await store.snapshot()).reads).toHaveLength(0)

  expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Correcto" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Revelar respuesta" }))

  fireEvent.click(screen.getByRole("button", { name: "Correcto" }))
  await waitFor(async () => expect((await store.snapshot()).reads).toHaveLength(1))
  expect((await store.snapshot()).reads[0]).toMatchObject({ note_id: "f1", grade: "correcto" })
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

test("click en el card de una nota abre el dialog con la nota completa; cerrarlo lo saca", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  expect(screen.queryByTestId("editor")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  await screen.findByTestId("editor")

  fireEvent.keyDown(document, { key: "Escape" })
  await waitFor(() => expect(screen.queryByTestId("editor")).not.toBeInTheDocument())
})

test("desde la card de una nota no se marca leído: su footer es navegación", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")

  expect(screen.queryByRole("button", { name: "Marcar leído" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Leído" })).not.toBeInTheDocument()

  expect(screen.getByRole("button", { name: "Volver" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }))
  await screen.findByText("Nota dos")
  expect(screen.getByRole("button", { name: "Volver" })).toBeEnabled()
  fireEvent.click(screen.getByRole("button", { name: "Volver" }))
  await screen.findByText("Nota uno")
  expect((await store.snapshot()).reads).toHaveLength(0)
})

test("volver a una nota ya marcada no la inserta de nuevo", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")

  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", { name: "Leído y siguiente" }),
  )
  await waitFor(async () => expect((await store.snapshot()).reads).toHaveLength(1))
  await screen.findByText("Nota dos")

  fireEvent.click(screen.getByRole("button", { name: "Volver" }))
  await screen.findByText("Nota uno")
  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  const btn = within(await screen.findByRole("dialog")).getByRole("button", { name: "Leído" })
  expect(btn).toBeDisabled()
  fireEvent.click(btn)
  expect((await store.snapshot()).reads).toHaveLength(1)
})

test("Leído desde adentro del dialog lo cierra y pasa a la siguiente", async () => {
  const { store } = renderReview()
  await screen.findByText("Nota uno")

  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  const dialog = await screen.findByRole("dialog")
  fireEvent.click(within(dialog).getByRole("button", { name: "Leído y siguiente" }))

  await waitFor(async () => expect((await store.snapshot()).reads).toHaveLength(1))
  expect((await store.snapshot()).reads[0]).toMatchObject({ note_id: "n1" })
  await screen.findByText("Nota dos")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

test("el dialog muestra cuántos repasos lleva la nota", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  const dialog = await screen.findByRole("dialog")
  expect(within(dialog).getByText("· sin repasos")).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole("button", { name: "Leído y siguiente" }))
  await screen.findByText("Nota dos")
  fireEvent.keyDown(document, { code: "KeyJ" })
  await screen.findByText("Nota uno")
  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  expect(
    await within(await screen.findByRole("dialog")).findByText("· 1 repaso"),
  ).toBeInTheDocument()
})

// ── Tira de hábitos ──────────────────────────────────────────────────────────

test("click en un tile de cantidad upsertea hoy, y el segundo click suma sobre la misma fila", async () => {
  const { store } = renderReview()
  const gym = await screen.findByRole("button", { name: "Registrar Gym" })

  fireEvent.click(gym)
  await waitFor(async () => expect((await store.snapshot()).habitLog).toHaveLength(1))
  expect((await store.snapshot()).habitLog[0]).toMatchObject({
    habit_id: "h1",
    day: todayKey(),
    amount: 1,
    target: 3,
  })

  fireEvent.click(gym)
  await waitFor(async () => expect((await store.snapshot()).habitLog[0].amount).toBe(2))
  expect((await store.snapshot()).habitLog).toEqual([
    { habit_id: "h1", day: todayKey(), amount: 2, target: 3 },
  ])
  expect(await screen.findByText("2/3")).toBeInTheDocument()
})

test("click en un check ya marcado lo deja en 0, no borra la fila", async () => {
  const { store } = renderReview({
    habitLog: [habitLogRow({ habit_id: "h2", day: todayKey(), amount: 1, target: 1 })],
  })
  const meditar = await screen.findByRole("button", { name: "Registrar Meditar" })
  await waitFor(() => expect(meditar).toHaveAttribute("aria-pressed", "true"))

  fireEvent.click(meditar)
  await waitFor(async () => expect((await store.snapshot()).habitLog[0].amount).toBe(0))
  expect((await store.snapshot()).habitLog).toHaveLength(1)
})

test("click en un tile de tiempo arranca el cronómetro y todavía no escribe", async () => {
  const { store } = renderReview()
  fireEvent.click(await screen.findByRole("button", { name: "Registrar Leer" }))

  await waitFor(() => expect(localStorage.getItem("bita-timer")).toBeTruthy())
  expect((await store.snapshot()).habitLog).toHaveLength(0)
  expect(await screen.findByRole("button", { name: "Pausar Leer" })).toBeInTheDocument()
})

test("un tiempo empezado y frenado ofrece reanudar, no registrar", async () => {
  renderReview({
    habitLog: [habitLogRow({ habit_id: "h3", day: todayKey(), amount: 7, target: 25 })],
  })

  expect(await screen.findByRole("button", { name: "Reanudar Leer" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Registrar Leer" })).not.toBeInTheDocument()
})

test("el chord h>1 registra el primer hábito de la tira", async () => {
  const { store } = renderReview()
  await screen.findByRole("button", { name: "Registrar Gym" })

  fireEvent.keyDown(document, { code: "KeyH" })
  fireEvent.keyDown(document, { code: "Digit1" })
  await waitFor(async () => expect((await store.snapshot()).habitLog).toHaveLength(1))
  expect((await store.snapshot()).habitLog[0]).toMatchObject({
    habit_id: "h1",
    day: todayKey(),
    amount: 1,
    target: 3,
  })
})

test("los tiles no le roban Enter / J / K al repaso", async () => {
  const { store } = renderReview()
  await screen.findByRole("button", { name: "Registrar Gym" })

  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Nota dos")
  fireEvent.keyDown(document, { code: "KeyJ" })
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "Enter" })
  await screen.findByRole("dialog")
  expect((await store.snapshot()).habitLog).toHaveLength(0)
})
