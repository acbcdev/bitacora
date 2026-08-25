import { coursesPage, retention, reviewQueue } from "@/core/store/derive"
import type { Course, Note } from "@/core/types/database"
import type { CoursesQuery, ReadRow } from "@/core/store/types"

// Estas funciones son la versión en JS de las RPC `courses_page` (0006-0009) y `review_queue`
// (0003). El SQL tiene su propio test (supabase/tests/); esto prueba que la otra implementación
// dice lo mismo — es lo único que sostiene que los dos adapters signifiquen lo mismo.

const course = (over: Partial<Course> = {}): Course => ({
  id: "c1",
  user_id: "u1",
  name: "Curso",
  status: "active",
  started_at: null,
  finished_at: null,
  icon: null,
  source: null,
  area: null,
  imported: false,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
})

const note = (over: Partial<Note> = {}): Note => ({
  id: "n1",
  user_id: "u1",
  course_id: "c1",
  title: "Nota",
  content: { type: "doc", content: [] },
  kind: "note",
  position: 0,
  imported: false,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
})

const query = (over: Partial<CoursesQuery> = {}): CoursesQuery => ({
  q: "",
  status: "todos",
  sort: "recientes",
  page: 1,
  pageSize: 24,
  ...over,
})

const read = (note_id: string, read_at: string): ReadRow => ({ note_id, read_at })

describe("coursesPage", () => {
  test("cuenta notas vivas, y `rondas` es el MÍNIMO de repasos entre ellas", () => {
    // Dos notas: una leída 3 veces, otra ninguna. La vuelta completa que diste es 0.
    const { rows } = coursesPage(
      [course()],
      [note({ id: "n1" }), note({ id: "n2" })],
      [read("n1", "2026-02-01T10:00:00Z"), read("n1", "2026-02-02T10:00:00Z")],
      query(),
    )
    expect(rows[0].notes).toBe(2)
    expect(rows[0].rounds).toBe(0)
    expect(rows[0].last_read).toBe("2026-02-02T10:00:00Z")
  })

  test("las flashcards y las notas borradas no cuentan para el progreso del curso", () => {
    const { rows } = coursesPage(
      [course()],
      [
        note({ id: "n1" }),
        note({ id: "f1", kind: "flashcard" }),
        note({ id: "n2", deleted_at: "2026-02-01T00:00:00Z" }),
      ],
      [],
      query(),
    )
    expect(rows[0].notes).toBe(1)
  })

  test("filtra por nombre sin distinguir mayúsculas y por estado", () => {
    const cursos = [
      course({ id: "c1", name: "React Avanzado" }),
      course({ id: "c2", name: "Postgres", status: "done" }),
    ]
    expect(coursesPage(cursos, [], [], query({ q: "react" })).rows).toHaveLength(1)
    expect(coursesPage(cursos, [], [], query({ q: "REACT" })).rows[0].id).toBe("c1")
    expect(coursesPage(cursos, [], [], query({ status: "done" })).rows[0].id).toBe("c2")
  })

  test("un curso borrado no aparece nunca", () => {
    const { rows, total } = coursesPage(
      [course({ deleted_at: "2026-02-01T00:00:00Z" })],
      [],
      [],
      query(),
    )
    expect(rows).toEqual([])
    expect(total).toBe(0)
  })

  test("`recientes` ordena por started_at desc con los nulos al final", () => {
    const cursos = [
      course({ id: "sin", started_at: null }),
      course({ id: "viejo", started_at: "2026-01-01T00:00:00Z" }),
      course({ id: "nuevo", started_at: "2026-06-01T00:00:00Z" }),
    ]
    const { rows } = coursesPage(cursos, [], [], query({ sort: "recientes" }))
    expect(rows.map((r) => r.id)).toEqual(["nuevo", "viejo", "sin"])
  })

  test("`rondas` ordena de más a menos vueltas completas", () => {
    const cursos = [course({ id: "c1" }), course({ id: "c2" })]
    const notas = [note({ id: "n1", course_id: "c1" }), note({ id: "n2", course_id: "c2" })]
    const { rows } = coursesPage(
      cursos,
      notas,
      [read("n2", "2026-02-01T10:00:00Z")],
      query({ sort: "rondas" }),
    )
    expect(rows.map((r) => r.id)).toEqual(["c2", "c1"])
  })

  test("pagina y devuelve el total sin paginar, repetido en cada fila", () => {
    const cursos = Array.from({ length: 5 }, (_, i) =>
      course({ id: `c${i}`, created_at: `2026-01-0${i + 1}T00:00:00Z` }),
    )
    const page2 = coursesPage(cursos, [], [], query({ page: 2, pageSize: 2 }))
    expect(page2.total).toBe(5)
    expect(page2.rows).toHaveLength(2)
    expect(page2.rows.every((r) => r.total_count === 5)).toBe(true)
    // created_at desc es el desempate: c4, c3 | c2, c1 | c0
    expect(page2.rows.map((r) => r.id)).toEqual(["c2", "c1"])
  })
})

describe("reviewQueue", () => {
  test("las nunca-leídas van primero, después la más vieja", () => {
    const notas = [note({ id: "leida-hoy" }), note({ id: "nunca" }), note({ id: "leida-vieja" })]
    const reads = [
      read("leida-hoy", "2026-06-01T10:00:00Z"),
      read("leida-vieja", "2026-01-01T10:00:00Z"),
    ]
    const queue = reviewQueue([course()], notas, reads, 3)
    expect(queue.map((n) => n.id)).toEqual(["nunca", "leida-vieja", "leida-hoy"])
  })

  test("de una nota leída varias veces manda la ÚLTIMA lectura, no la primera", () => {
    const notas = [note({ id: "a" }), note({ id: "b" })]
    const reads = [
      read("a", "2026-01-01T10:00:00Z"),
      read("a", "2026-06-01T10:00:00Z"), // a se leyó recién → va última
      read("b", "2026-03-01T10:00:00Z"),
    ]
    expect(reviewQueue([course()], notas, reads, 3).map((n) => n.id)).toEqual(["b", "a"])
  })

  test("deja afuera notas borradas, sin curso, o de un curso borrado", () => {
    const cursos = [course({ id: "vivo" }), course({ id: "muerto", deleted_at: "2026-02-01Z" })]
    const notas = [
      note({ id: "ok", course_id: "vivo" }),
      note({ id: "borrada", course_id: "vivo", deleted_at: "2026-02-01Z" }),
      note({ id: "huerfana", course_id: null }),
      note({ id: "de-curso-muerto", course_id: "muerto" }),
    ]
    expect(reviewQueue(cursos, notas, [], 9).map((n) => n.id)).toEqual(["ok"])
  })

  test("el status del curso NO filtra: paused y done entran igual", () => {
    const cursos = [course({ id: "a", status: "paused" }), course({ id: "b", status: "done" })]
    const notas = [note({ id: "n1", course_id: "a" }), note({ id: "n2", course_id: "b" })]
    expect(reviewQueue(cursos, notas, [], 9)).toHaveLength(2)
  })

  test("corta en el límite", () => {
    const notas = Array.from({ length: 10 }, (_, i) => note({ id: `n${i}` }))
    expect(reviewQueue([course()], notas, [], 3)).toHaveLength(3)
  })
})

describe("retention", () => {
  test("es correctos sobre el total de autoevaluaciones, redondeado, por curso", () => {
    const pct = retention([
      { grade: "correcto", course_id: "c1" },
      { grade: "parcial", course_id: "c1" },
      { grade: "incorrecto", course_id: "c1" },
      { grade: "correcto", course_id: "c2" },
    ])
    expect(pct.get("c1")).toBe(33)
    expect(pct.get("c2")).toBe(100)
  })

  test("una autoevaluación de una nota sin curso no cuenta para nadie", () => {
    expect(retention([{ grade: "correcto", course_id: null }]).size).toBe(0)
  })
})
