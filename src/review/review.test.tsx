import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { Review } from "@/review/review"
import { notebook, habit, note, renderApp } from "@/test/harness"
import { store as appStore } from "@/core/store"
import type { Snapshot } from "@/core/store/types"
import type { TiptapDoc } from "@/core/types/database"

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

afterEach(() => vi.restoreAllMocks())

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

function doc(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  } as unknown as TiptapDoc
}

function twoNotesWithContent(): Partial<Snapshot> {
  return {
    notes: [
      note({
        id: "n1",
        title: "Nota uno",
        content: doc("Cuerpo uno"),
        created_at: "2026-01-01T00:00:01Z",
      }),
      note({
        id: "n2",
        title: "Nota dos",
        content: doc("Cuerpo dos"),
        created_at: "2026-01-01T00:00:02Z",
      }),
    ] as unknown as Snapshot["notes"],
  }
}

test("card desde nota completa: con store.note demorado, el título nuevo no llega antes que su contenido", async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const real = appStore.note.bind(appStore)
  vi.spyOn(appStore, "note").mockImplementation(async (id) => {
    if (id === "n2") await gate
    return real(id)
  })
  renderReview(twoNotesWithContent())
  await screen.findByText("Cuerpo uno")
  fireEvent.keyDown(document, { code: "ArrowRight" })
  // keep previous data: sigue la anterior, sin skeleton y sin el título nuevo suelto
  expect(screen.getByText("Nota uno")).toBeInTheDocument()
  expect(screen.getByText("Cuerpo uno")).toBeInTheDocument()
  expect(screen.queryByText("Nota dos")).toBeNull()
  act(() => release())
  await screen.findByText("Nota dos")
  expect(screen.getByText("Cuerpo dos")).toBeInTheDocument()
})

test("prefetch: al mostrar la nota i ya se pidió la i+1; ← es instantáneo", async () => {
  const spy = vi.spyOn(appStore, "note")
  renderReview(twoNotesWithContent())
  await screen.findByText("Cuerpo uno")
  await waitFor(() => expect(spy).toHaveBeenCalledWith("n2"))
  fireEvent.keyDown(document, { code: "ArrowRight" })
  await screen.findByText("Cuerpo dos")
  fireEvent.keyDown(document, { code: "ArrowLeft" })
  expect(screen.getByText("Cuerpo uno")).toBeInTheDocument() // sync: ya en cache
})

// store.note demorado para un id: la nota completa de ese id no llega hasta `release()`.
function gateNote(gatedId: string) {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const real = appStore.note.bind(appStore)
  const spy = vi.spyOn(appStore, "note").mockImplementation(async (id) => {
    if (id === gatedId) await gate
    return real(id)
  })
  return { spy, release: () => act(() => release()) }
}

test("flashcard → nota demorada: el placeholder nunca es la flashcard (no filtra la respuesta)", async () => {
  const { release } = gateNote("n2")
  renderReview({
    notes: [
      note({ id: "n1", title: "Nota uno", created_at: "2026-01-01T00:00:01Z" }),
      note({
        id: "f1",
        title: "Pregunta uno",
        kind: "flashcard",
        content: doc("Respuesta secreta"),
        created_at: "2026-01-01T00:00:02Z",
      }),
      note({ id: "n2", title: "Nota dos", created_at: "2026-01-01T00:00:03Z" }),
    ] as unknown as Snapshot["notes"],
  })
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "ArrowRight" })
  fireEvent.click(await screen.findByRole("button", { name: "Revelar respuesta" }))
  await screen.findByText("Respuesta secreta")
  fireEvent.keyDown(document, { code: "ArrowRight" })
  expect(screen.queryByText("Pregunta uno")).toBeNull()
  expect(screen.queryByText("Respuesta secreta")).toBeNull()
  release()
  await screen.findByText("Nota dos")
})

test("placeholder: la card entera es la anterior (notebook, posición, ←), no mezclada", async () => {
  const { release } = gateNote("n2")
  renderReview({
    notebooks: [
      notebook({ id: "c1", name: "Primero", created_at: "2026-01-01" }),
      notebook({ id: "c2", name: "Segundo", created_at: "2026-01-02" }),
    ],
    notes: [
      note({ id: "n1", title: "Nota uno", notebook_id: "c1", created_at: "2026-01-01T00:00:01Z" }),
      note({ id: "n2", title: "Nota dos", notebook_id: "c2", created_at: "2026-01-01T00:00:02Z" }),
    ] as unknown as Snapshot["notes"],
  })
  const card = () => screen.getByRole("button", { name: /^Abrir Nota/ }).parentElement!
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "ArrowRight" })
  expect(within(card()).getByText("Nota uno")).toBeInTheDocument()
  expect(within(card()).getByText("Primero")).toBeInTheDocument()
  expect(within(card()).queryByText("Segundo")).toBeNull()
  expect(within(card()).queryByText("2 / 2")).toBeNull()
  expect(within(card()).getByRole("button", { name: "Anterior" })).toBeDisabled()
  release()
  await within(card()).findByText("Nota dos")
  expect(within(card()).getByText("Segundo")).toBeInTheDocument()
  expect(within(card()).getByText("2 / 2")).toBeInTheDocument()
  expect(within(card()).getByRole("button", { name: "Anterior" })).toBeEnabled()
})

test("primera carga sin nota completa: skeleton, no una card con título vacío", async () => {
  const { spy, release } = gateNote("n1")
  renderReview()
  await waitFor(() => expect(spy).toHaveBeenCalledWith("n1"))
  expect(screen.queryByRole("button", { name: /^Abrir/ })).toBeNull()
  expect(screen.queryByText("Gym")).toBeNull() // pantalla en skeleton
  release()
  await screen.findByText("Nota uno")
})
