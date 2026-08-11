import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { Course } from "@/courses/course"

const { insertNotes, updateRow, invokeFn, state } = vi.hoisted(() => ({
  insertNotes: vi.fn((_input: unknown) => Promise.resolve({ error: null })),
  updateRow: vi.fn((_input: unknown) => {}),
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
      update: (input: unknown) => {
        updateRow(input)
        return chain
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
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/course/c1"]}>
        <TooltipProvider>
          <Routes>
            <Route path="/course/:id" element={<Course focus={false} setFocus={() => {}} />} />
            <Route
              path="/course/:id/:noteId"
              element={<Course focus={false} setFocus={() => {}} />}
            />
          </Routes>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  insertNotes.mockClear()
  updateRow.mockClear()
  invokeFn.mockClear()
  state.notes = [
    { id: "n1", title: "Nota 1", content: { type: "doc" }, course_id: "c1", position: 0 },
  ]
})

// Radix abre el menú con pointerdown, no con click; en jsdom es más estable dispararlo por
// teclado (Enter en el trigger), que es el mismo camino que usa alguien navegando con tab.
function openCourseMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Acciones del curso" }), { key: "Enter" })
}

test("Generar flashcards invoca la edge function e inserta cada par como nota kind: flashcard", async () => {
  renderCourse()
  await screen.findByText("Curso")

  openCourseMenu()
  fireEvent.click(await screen.findByRole("menuitem", { name: /Generar flashcards/ }))

  await waitFor(() =>
    expect(invokeFn).toHaveBeenCalledWith("generate-flashcards", { body: { course_id: "c1" } }),
  )
  await waitFor(() => expect(insertNotes).toHaveBeenCalledTimes(1))
  const inserted = insertNotes.mock.calls[0][0] as { kind: string; title: string }[]
  expect(inserted).toHaveLength(2)
  expect(inserted.every((n) => n.kind === "flashcard")).toBe(true)
  expect(inserted.map((n) => n.title)).toEqual(["¿Qué es X?", "¿Qué es Z?"])
})

// Borrar es soft delete (deleted_at, ADR 0002) y va detrás de una confirmación: el menú se
// desmonta al elegir el item, así que el AlertDialog vive fuera del DropdownMenu.
test("Borrar curso pide confirmación antes de tocar la DB", async () => {
  renderCourse()
  await screen.findByText("Curso")

  openCourseMenu()
  fireEvent.click(await screen.findByRole("menuitem", { name: /Borrar curso/ }))
  await screen.findByRole("alertdialog")
  expect(updateRow).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: "Borrar" }))
  await waitFor(() =>
    expect(updateRow).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    ),
  )
})

test("Editar curso abre el form con los datos del curso", async () => {
  renderCourse()
  await screen.findByText("Curso")

  openCourseMenu()
  fireEvent.click(await screen.findByRole("menuitem", { name: /Editar curso/ }))

  await screen.findByRole("dialog")
  expect(screen.getByLabelText("Nombre")).toHaveValue("Curso")
})

// En mobile los dos paneles se apilan (índice arriba, nota abajo): elegir del índice tiene que
// llevarte a la nota, si no el tap parece no hacer nada.
test("en mobile, elegir una nota del índice scrollea al panel de la nota", async () => {
  state.notes = [
    { id: "n1", title: "Nota 1", content: { type: "doc" }, course_id: "c1", position: 0 },
    { id: "n2", title: "Nota 2", content: { type: "doc" }, course_id: "c1", position: 1 },
  ]
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 375 })
  const scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView

  renderCourse()
  fireEvent.click(await screen.findByRole("button", { name: /Nota 2/ }))

  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" })
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 })
})

test("el botón queda deshabilitado si el curso no tiene notas", async () => {
  state.notes = []
  renderCourse()
  await screen.findByText("Curso")

  openCourseMenu()
  expect(await screen.findByRole("menuitem", { name: /Generar flashcards/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  )
})

// mod+j / mod+k: alias forzado (enableOnContentEditable) para navegar entre notas con el foco
// adentro del editor — j,k solos se desactivan ahí por default de la lib. ctrlKey: true porque
// jsdom reporta un userAgent sin "mac", así que "mod" resuelve a ctrlKey acá, no metaKey.
test("mod+k / mod+j mueven entre notas del curso", async () => {
  state.notes = [
    { id: "n1", title: "Nota 1", content: { type: "doc" }, course_id: "c1", position: 0 },
    { id: "n2", title: "Nota 2", content: { type: "doc" }, course_id: "c1", position: 1 },
  ]
  const { container } = renderCourse()
  await screen.findByText("Nota 1")

  fireEvent.keyDown(document, { code: "KeyK", ctrlKey: true })
  await waitFor(() =>
    expect(container.querySelector('button[data-active="true"]')?.textContent).toContain("Nota 2"),
  )

  fireEvent.keyDown(document, { code: "KeyJ", ctrlKey: true })
  await waitFor(() =>
    expect(container.querySelector('button[data-active="true"]')?.textContent).toContain("Nota 1"),
  )
})
