import {
  notebookNotes,
  notebooksPage,
  frozenTarget,
  liveNotebooks,
  noteRefs,
  retention,
  reviewQueue,
  type NotebooksQuery,
} from "@/core/store/derive"
import type { Notebook } from "@/core/types/database"
import type { NoteRef, ReadRow, Snapshot } from "@/core/store/types"

// `derive.ts` es donde vive TODA la derivación del dominio, y la comparten los dos adapters. Es
// además la versión en JS de lo que hacían las RPC `notebooks_page` (0006-0009) y `review_queue`
// (0003), que quedaron sin llamador. Sin estos tests, "modo local" y "modo Supabase" sólo se
// parecen.
//
// Nota: el snapshot ya viene filtrado por el adapter (sólo filas vivas), así que acá no hay casos
// de `deleted_at` — esa regla se testea del lado del adapter (local-store.test.ts).

const notebook = (over: Partial<Notebook> = {}): Notebook => ({
  id: "c1",
  user_id: "u1",
  name: "Notebook",
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

const note = (over: Partial<NoteRef> = {}): NoteRef => ({
  id: "n1",
  title: "Nota",
  notebook_id: "c1",
  position: 0,
  kind: "note",
  created_at: "2026-01-01T00:00:00Z",
  ...over,
})

const read = (note_id: string, read_at: string, grade: ReadRow["grade"] = null): ReadRow => ({
  note_id,
  read_at,
  grade,
})

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  notebooks: [notebook()],
  notes: [],
  reads: [],
  habits: [],
  habitLog: [],
  ...over,
})

const query = (over: Partial<NotebooksQuery> = {}): NotebooksQuery => ({
  q: "",
  status: "todos",
  sort: "recientes",
  page: 1,
  pageSize: 24,
  ...over,
})

describe("liveNotebooks", () => {
  test("ordena active → paused → done, y dentro de cada grupo el más nuevo primero", () => {
    const snap = snapshot({
      notebooks: [
        notebook({ id: "done", status: "done" }),
        notebook({ id: "viejo", created_at: "2026-01-01T00:00:00Z" }),
        notebook({ id: "paused", status: "paused" }),
        notebook({ id: "nuevo", created_at: "2026-05-01T00:00:00Z" }),
      ],
    })
    expect(liveNotebooks(snap).map((c) => c.id)).toEqual(["nuevo", "viejo", "paused", "done"])
  })
})

describe("notebookNotes / noteRefs", () => {
  test("las del notebook, por position, y sin flashcards (no se listan en el notebook)", () => {
    const snap = snapshot({
      notes: [
        note({ id: "b", position: 1 }),
        note({ id: "a", position: 0 }),
        note({ id: "f", kind: "flashcard", position: 2 }),
        note({ id: "otra", notebook_id: "c2" }),
      ],
    })
    expect(notebookNotes(snap, "c1").map((n) => n.id)).toEqual(["a", "b"])
    expect(noteRefs(snap).map((n) => n.id)).toEqual(["a", "otra", "b"])
  })
})

describe("notebooksPage", () => {
  test("cuenta notas y `rondas` es el MÍNIMO de repasos entre ellas", () => {
    // Dos notas: una leída dos veces, otra ninguna. La vuelta completa que diste es 0.
    const snap = snapshot({
      notes: [note({ id: "n1" }), note({ id: "n2" })],
      reads: [read("n1", "2026-02-01T10:00:00Z"), read("n1", "2026-02-02T10:00:00Z")],
    })
    const { rows } = notebooksPage(snap, query())
    expect(rows[0].notes).toBe(2)
    expect(rows[0].rounds).toBe(0)
    expect(rows[0].last_read).toBe("2026-02-02T10:00:00Z")
  })

  test("las flashcards no cuentan para el progreso del notebook", () => {
    const snap = snapshot({ notes: [note({ id: "n1" }), note({ id: "f1", kind: "flashcard" })] })
    expect(notebooksPage(snap, query()).rows[0].notes).toBe(1)
  })

  test("filtra por nombre sin distinguir mayúsculas y por estado", () => {
    const snap = snapshot({
      notebooks: [
        notebook({ id: "c1", name: "React Avanzado" }),
        notebook({ id: "c2", name: "Postgres", status: "done" }),
      ],
    })
    expect(notebooksPage(snap, query({ q: "react" })).rows).toHaveLength(1)
    expect(notebooksPage(snap, query({ q: "REACT" })).rows[0].id).toBe("c1")
    expect(notebooksPage(snap, query({ status: "done" })).rows[0].id).toBe("c2")
  })

  test("`recientes` ordena por started_at desc con los nulos al final", () => {
    const snap = snapshot({
      notebooks: [
        notebook({ id: "sin", started_at: null }),
        notebook({ id: "viejo", started_at: "2026-01-01T00:00:00Z" }),
        notebook({ id: "nuevo", started_at: "2026-06-01T00:00:00Z" }),
      ],
    })
    expect(notebooksPage(snap, query()).rows.map((r) => r.id)).toEqual(["nuevo", "viejo", "sin"])
  })

  test("`rondas` ordena de más a menos vueltas completas", () => {
    const snap = snapshot({
      notebooks: [notebook({ id: "c1" }), notebook({ id: "c2" })],
      notes: [note({ id: "n1", notebook_id: "c1" }), note({ id: "n2", notebook_id: "c2" })],
      reads: [read("n2", "2026-02-01T10:00:00Z")],
    })
    expect(notebooksPage(snap, query({ sort: "rondas" })).rows.map((r) => r.id)).toEqual([
      "c2",
      "c1",
    ])
  })

  test("pagina y el total es el de TODO el filtro, repetido en cada fila", () => {
    const snap = snapshot({
      notebooks: Array.from({ length: 5 }, (_, i) =>
        notebook({ id: `c${i}`, created_at: `2026-01-0${i + 1}T00:00:00Z` }),
      ),
    })
    const page2 = notebooksPage(snap, query({ page: 2, pageSize: 2 }))
    expect(page2.total).toBe(5)
    expect(page2.rows.map((r) => r.id)).toEqual(["c2", "c1"]) // created_at desc: c4,c3 | c2,c1 | c0
    expect(page2.rows.every((r) => r.total_count === 5)).toBe(true)
  })

  test("una página fuera de rango sigue informando el total real", () => {
    // La RPC devolvía `total_count` leyéndolo de la primera fila, así que sin filas informaba 0.
    const snap = snapshot({ notebooks: [notebook()] })
    expect(notebooksPage(snap, query({ page: 9 }))).toEqual({ rows: [], total: 1 })
  })
})

describe("reviewQueue", () => {
  test("las nunca-leídas van primero, después la más vieja", () => {
    const snap = snapshot({
      notes: [note({ id: "leida-hoy" }), note({ id: "nunca" }), note({ id: "leida-vieja" })],
      reads: [
        read("leida-hoy", "2026-06-01T10:00:00Z"),
        read("leida-vieja", "2026-01-01T10:00:00Z"),
      ],
    })
    expect(reviewQueue(snap, 3).map((n) => n.id)).toEqual(["nunca", "leida-vieja", "leida-hoy"])
  })

  test("de una nota leída varias veces manda la ÚLTIMA lectura, no la primera", () => {
    const snap = snapshot({
      notes: [note({ id: "a" }), note({ id: "b" })],
      reads: [
        read("a", "2026-01-01T10:00:00Z"),
        read("a", "2026-06-01T10:00:00Z"), // `a` se leyó recién → va última
        read("b", "2026-03-01T10:00:00Z"),
      ],
    })
    expect(reviewQueue(snap, 3).map((n) => n.id)).toEqual(["b", "a"])
  })

  test("deja afuera las notas sin notebook y las de un notebook que ya no está", () => {
    const snap = snapshot({
      notebooks: [notebook({ id: "vivo" })],
      notes: [
        note({ id: "ok", notebook_id: "vivo" }),
        note({ id: "huerfana", notebook_id: null }),
        note({ id: "de-notebook-muerto", notebook_id: "otro" }),
      ],
    })
    expect(reviewQueue(snap, 9).map((n) => n.id)).toEqual(["ok"])
  })

  test("el status del notebook NO filtra: paused y done entran igual", () => {
    const snap = snapshot({
      notebooks: [notebook({ id: "a", status: "paused" }), notebook({ id: "b", status: "done" })],
      notes: [note({ id: "n1", notebook_id: "a" }), note({ id: "n2", notebook_id: "b" })],
    })
    expect(reviewQueue(snap, 9)).toHaveLength(2)
  })

  test("las flashcards entran a la cola (sólo se mezclan por antigüedad)", () => {
    const snap = snapshot({ notes: [note({ id: "n" }), note({ id: "f", kind: "flashcard" })] })
    expect(reviewQueue(snap, 9)).toHaveLength(2)
  })

  test("corta en el límite", () => {
    const snap = snapshot({ notes: Array.from({ length: 10 }, (_, i) => note({ id: `n${i}` })) })
    expect(reviewQueue(snap, 3)).toHaveLength(3)
  })
})

describe("retention", () => {
  test("es correctos sobre el total de autoevaluaciones, redondeado, por notebook", () => {
    const snap = snapshot({
      notes: [note({ id: "n1", notebook_id: "c1" }), note({ id: "n2", notebook_id: "c2" })],
      reads: [
        read("n1", "2026-02-01T10:00:00Z", "correcto"),
        read("n1", "2026-02-02T10:00:00Z", "parcial"),
        read("n1", "2026-02-03T10:00:00Z", "incorrecto"),
        read("n2", "2026-02-01T10:00:00Z", "correcto"),
      ],
    })
    const pct = retention(snap)
    expect(pct.get("c1")).toBe(33)
    expect(pct.get("c2")).toBe(100)
  })

  test("un repaso sin grade (nota normal) no entra en el cálculo", () => {
    const snap = snapshot({
      notes: [note({ id: "n1" })],
      reads: [read("n1", "2026-02-01T10:00:00Z")],
    })
    expect(retention(snap).size).toBe(0)
  })
})

describe("frozenTarget", () => {
  // La regla de ADR 0009, en un solo lugar. Antes vivía duplicada en los dos adapters y NO
  // coincidían: el local respetaba el target guardado y el de Supabase lo pisaba con el del upsert.
  test("un día ya registrado conserva SU target aunque la meta viva haya cambiado", () => {
    const log = [{ habit_id: "h1", day: "2026-08-25", amount: 1, target: 3 }]
    expect(frozenTarget(log, "h1", "2026-08-25", 10)).toBe(3)
  })

  test("un día sin fila se congela con la meta viva", () => {
    expect(frozenTarget([], "h1", "2026-08-25", 10)).toBe(10)
  })
})
