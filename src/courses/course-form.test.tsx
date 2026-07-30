import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { CourseForm } from "@/courses/course-form"
import type { Course } from "@/core/types/database"

const { insert, update } = vi.hoisted(() => ({
  insert: vi.fn((_input: unknown) => Promise.resolve({ error: null })),
  update: vi.fn((_input: unknown) => Promise.resolve({ error: null })),
}))

const courses = [
  {
    id: "c1",
    name: "Curso 1",
    status: "active",
    source: "Platzi",
    area: "Programación",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "c2",
    name: "Curso 2",
    status: "active",
    source: "Platzi",
    area: "Marketing",
    created_at: "2026-01-02T00:00:00Z",
  },
  {
    id: "c3",
    name: "Curso 3",
    status: "active",
    source: null,
    area: null,
    created_at: "2026-01-03T00:00:00Z",
  },
]

// Cadena thenable que imita al PostgrestBuilder real (select/is se resuelven al await).
// insert/update devuelven directo — CourseForm no encadena nada más sobre ellos salvo `.eq`.
vi.mock("@/core/lib/supabase", () => {
  const query = () => {
    const chain = {
      select: () => chain,
      is: () => chain,
      insert: (input: unknown) => {
        insert(input)
        return Promise.resolve({ error: null })
      },
      update: (input: unknown) => ({
        eq: () => {
          update(input)
          return Promise.resolve({ error: null })
        },
      }),
      // oxlint-disable-next-line unicorn/no-thenable -- imita al builder real de supabase-js
      then: (fn: (r: unknown) => unknown) =>
        Promise.resolve({ data: courses, error: null }).then(fn),
    }
    return chain
  }
  return { supabase: { from: query } }
})

const course2: Course = {
  id: "c2",
  user_id: "u1",
  name: "Curso 2",
  status: "active",
  started_at: null,
  finished_at: null,
  icon: null,
  source: "Platzi",
  area: "Marketing",
  imported: false,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00Z",
}

function renderForm(course: Course | null, onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <CourseForm course={course} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose }
}

beforeEach(() => {
  insert.mockClear()
  update.mockClear()
})

// Dialog (Radix) portalea el contenido a document.body, así que las opciones se buscan ahí
// y no en el `container` de RTL.
test("el datalist sugiere los valores de source/area ya usados, sin duplicados", async () => {
  renderForm(null)

  await waitFor(() =>
    expect(document.querySelectorAll("#course-source-options option")).toHaveLength(1),
  )
  const sourceOptions = [...document.querySelectorAll("#course-source-options option")].map(
    (o) => (o as HTMLOptionElement).value,
  )
  const areaOptions = [...document.querySelectorAll("#course-area-options option")].map(
    (o) => (o as HTMLOptionElement).value,
  )
  expect(sourceOptions).toEqual(["Platzi"])
  expect(areaOptions.toSorted()).toEqual(["Marketing", "Programación"])
})

test("crear un curso manda source/area tipeados en el payload", async () => {
  renderForm(null)

  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Curso nuevo" } })
  fireEvent.change(screen.getByLabelText("Fuente"), { target: { value: "web.dev" } })
  fireEvent.change(screen.getByLabelText("Área"), { target: { value: "Inglés" } })
  fireEvent.click(screen.getByRole("button", { name: "Crear curso" }))

  await waitFor(() =>
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ source: "web.dev", area: "Inglés" }),
    ),
  )
})

test("editar un curso manda source/area tipeados en el payload", async () => {
  renderForm(course2)

  fireEvent.change(screen.getByLabelText("Fuente"), { target: { value: "Udemy" } })
  fireEvent.change(screen.getByLabelText("Área"), { target: { value: "Marketing digital" } })
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

  await waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ source: "Udemy", area: "Marketing digital" }),
    ),
  )
})

test("source/area vacíos no rompen el submit y mandan null", async () => {
  renderForm(null)

  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Curso sin fuente" } })
  fireEvent.click(screen.getByRole("button", { name: "Crear curso" }))

  await waitFor(() =>
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ source: null, area: null })),
  )
})
