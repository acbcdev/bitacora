import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { todayKey } from "@/core/lib/stats"
import { Review } from "@/review/review"

// Spy hoisted para poder referenciarlo dentro del factory de vi.mock. El insert además guarda la
// fila en `readLog`: las stats ("leídas hoy", racha) se derivan de read_log, así que sin esto no
// se puede testear que se refresquen.
// Idem para el log de hábitos, con una diferencia: registrar es un UPSERT sobre (habit_id, day),
// así que el fake pisa la fila del día en vez de agregar una nueva — es lo que testean los casos
// de más abajo.
const { insertReadLog, readLog, upsertHabitLog, habitLog } = vi.hoisted(() => {
  const rows: unknown[] = []
  type LogRow = { habit_id: string; day: string; amount: number; target: number }
  const habitRows: LogRow[] = []
  return {
    readLog: rows,
    habitLog: habitRows,
    insertReadLog: vi.fn((row: { note_id: string }) => {
      rows.push({ ...row, read_at: new Date().toISOString() })
      return Promise.resolve({ error: null })
    }),
    upsertHabitLog: vi.fn((row: LogRow) => {
      const prev = habitRows.find((r) => r.habit_id === row.habit_id && r.day === row.day)
      if (prev) Object.assign(prev, row)
      else habitRows.push({ ...row })
      return Promise.resolve({ error: null })
    }),
  }
})

// Mock del cliente Supabase: cola de 2 notas + un curso. Sin red.
vi.mock("@/core/lib/supabase", () => {
  // Tres hábitos, uno por métrica: el orden es el de la tira y el del chord h>1..9.
  const habit = (over: Record<string, unknown>) => ({
    user_id: "u1",
    icon: null,
    kind: "good",
    days: null,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  })
  const rows: Record<string, unknown[]> = {
    courses: [{ id: "c1", name: "Curso", status: "active", created_at: "2026-01-01" }],
    notes: [],
    read_log: readLog,
    habits: [
      habit({ id: "h1", name: "Gym", metric: "count", target: 3, period: "week" }),
      habit({ id: "h2", name: "Meditar", metric: "check", target: 1, period: "day" }),
      habit({ id: "h3", name: "Leer", metric: "time", target: 25, period: "day" }),
    ],
    habit_log: habitLog,
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
      upsert: upsertHabitLog,
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
  upsertHabitLog.mockClear()
  readLog.length = 0
  habitLog.length = 0
  localStorage.clear()
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

  // Se vuelve visible → recién ahí Enter marca leído. Desde el dialog SÍ avanza: cierra y pasa a
  // la siguiente de una (adentro sí leíste la nota).
  markReadButtonVisible(true)
  fireEvent.keyDown(document, { code: "Enter" })
  await screen.findByText("Nota dos")
  expect(insertReadLog).toHaveBeenCalledWith({ note_id: "n1", grade: undefined })
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByText("2 / 3")).toBeInTheDocument()
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

test("volver con J a una nota ya marcada no la inserta de nuevo", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  fireEvent.click(screen.getByRole("button", { name: "Marcar leído" }))
  await waitFor(() => expect(insertReadLog).toHaveBeenCalledTimes(1))

  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Nota dos")
  fireEvent.keyDown(document, { code: "KeyJ" })
  await screen.findByText("Nota uno")

  // El estado "leído" es por nota, no por posición en la cola: el botón sigue apagado.
  const btn = await screen.findByRole("button", { name: "Leído" })
  expect(btn).toBeDisabled()
  fireEvent.click(btn)
  expect(insertReadLog).toHaveBeenCalledTimes(1)
})

test("Leído desde adentro del dialog lo cierra y pasa a la siguiente", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  const dialog = await screen.findByRole("dialog")
  fireEvent.click(within(dialog).getByRole("button", { name: "Leído y siguiente" }))

  await waitFor(() => expect(insertReadLog).toHaveBeenCalledTimes(1))
  expect(insertReadLog).toHaveBeenCalledWith({ note_id: "n1", grade: undefined })
  await screen.findByText("Nota dos")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

test("el dialog muestra cuántos repasos lleva la nota", async () => {
  renderReview()
  await screen.findByText("Nota uno")

  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  const dialog = await screen.findByRole("dialog")
  expect(within(dialog).getByText("· sin repasos")).toBeInTheDocument()

  // Marcar leído mete la fila en read_log → al reabrir la nota el contador ya la cuenta.
  fireEvent.click(within(dialog).getByRole("button", { name: "Leído y siguiente" }))
  await screen.findByText("Nota dos")
  fireEvent.keyDown(document, { code: "KeyJ" })
  await screen.findByText("Nota uno")
  fireEvent.click(screen.getByRole("button", { name: /Nota uno/ }))
  expect(
    await within(await screen.findByRole("dialog")).findByText("· 1 repaso"),
  ).toBeInTheDocument()
})

// ── Tira de hábitos ───────────────────────────────────────────────────────────────────────────
// Todo lo que escribe pasa por un upsert sobre (habit_id, day): el +1, el toggle y el panel son
// el mismo camino, así que alcanza con mirar con qué se llama.

test("click en un tile de cantidad upsertea hoy, y el segundo click suma sobre la misma fila", async () => {
  renderReview()
  const gym = await screen.findByRole("button", { name: "Registrar Gym" })

  fireEvent.click(gym)
  await waitFor(() => expect(upsertHabitLog).toHaveBeenCalledTimes(1))
  expect(upsertHabitLog).toHaveBeenCalledWith(
    { habit_id: "h1", day: todayKey(), amount: 1, target: 3 },
    { onConflict: "habit_id,day" },
  )

  fireEvent.click(gym)
  await waitFor(() => expect(upsertHabitLog).toHaveBeenCalledTimes(2))
  expect(upsertHabitLog).toHaveBeenLastCalledWith(
    expect.objectContaining({ amount: 2 }),
    expect.anything(),
  )
  // Upsert, no insert: sigue habiendo una sola fila para el día.
  expect(habitLog).toEqual([{ habit_id: "h1", day: todayKey(), amount: 2, target: 3 }])
  expect(await screen.findByText("2/3")).toBeInTheDocument()
})

test("click en un check ya marcado lo deja en 0, no borra la fila", async () => {
  habitLog.push({ habit_id: "h2", day: todayKey(), amount: 1, target: 1 })
  renderReview()
  const meditar = await screen.findByRole("button", { name: "Registrar Meditar" })
  await waitFor(() => expect(meditar).toHaveAttribute("aria-pressed", "true"))

  fireEvent.click(meditar)
  await waitFor(() => expect(upsertHabitLog).toHaveBeenCalledTimes(1))
  expect(upsertHabitLog).toHaveBeenCalledWith(
    { habit_id: "h2", day: todayKey(), amount: 0, target: 1 },
    { onConflict: "habit_id,day" },
  )
  expect(habitLog).toHaveLength(1)
})

test("click en un tile de tiempo arranca el cronómetro y todavía no escribe", async () => {
  renderReview()
  fireEvent.click(await screen.findByRole("button", { name: "Registrar Leer" }))

  // El tiempo hecho entra en la DB recién al pausar o al llegar a la meta.
  await waitFor(() => expect(localStorage.getItem("bita-timer")).toBeTruthy())
  expect(upsertHabitLog).not.toHaveBeenCalled()
  expect(await screen.findByRole("button", { name: "Pausar Leer" })).toBeInTheDocument()
})

// Pausado no es un estado en la DB: es tiempo hecho + nada corriendo. Lo único que lo distingue
// de "nunca arrancaste" es el label del botón (y el ‖ ámbar, que es decorativo).
test("un tiempo empezado y frenado ofrece reanudar, no registrar", async () => {
  habitLog.push({ habit_id: "h3", day: todayKey(), amount: 7, target: 25 })
  renderReview()

  expect(await screen.findByRole("button", { name: "Reanudar Leer" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Registrar Leer" })).not.toBeInTheDocument()
})

test("el chord h>1 registra el primer hábito de la tira", async () => {
  renderReview()
  await screen.findByRole("button", { name: "Registrar Gym" })

  fireEvent.keyDown(document, { code: "KeyH" })
  fireEvent.keyDown(document, { code: "Digit1" })
  await waitFor(() => expect(upsertHabitLog).toHaveBeenCalledTimes(1))
  expect(upsertHabitLog).toHaveBeenCalledWith(
    { habit_id: "h1", day: todayKey(), amount: 1, target: 3 },
    { onConflict: "habit_id,day" },
  )
})

test("los tiles no le roban Enter / J / K al repaso", async () => {
  renderReview()
  await screen.findByRole("button", { name: "Registrar Gym" })

  fireEvent.keyDown(document, { code: "KeyK" })
  await screen.findByText("Nota dos")
  fireEvent.keyDown(document, { code: "KeyJ" })
  await screen.findByText("Nota uno")
  fireEvent.keyDown(document, { code: "Enter" })
  await screen.findByRole("dialog")
  expect(upsertHabitLog).not.toHaveBeenCalled()
})
