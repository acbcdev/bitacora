import { localStore } from "@/core/store/local-store"

// El adapter local se testea SIN mocks: localStorage es real (jsdom) y no hay red. Esa es la
// diferencia con el adapter de Supabase, que sólo se puede testear imitando su cliente.
//
// Acá se prueba lo único que el adapter decide: qué filas salen en el snapshot y qué pasa al
// escribir. Todo lo derivado (cola, página de cursos, retención) es de `derive.ts` y se prueba
// aparte, una sola vez para los dos adapters.

const store = localStore()

beforeEach(() => localStorage.clear())

async function seedCourse() {
  await store.save("courses", { name: "React" })
  const snap = await store.snapshot()
  return snap.courses[0]
}

test("una nota creada se lee de vuelta, y editarla persiste", async () => {
  const curso = await seedCourse()
  const nota = await store.save("notes", { course_id: curso.id, position: 0 })

  expect(await store.note(nota.id)).toMatchObject({ course_id: curso.id, title: "" })

  await store.save("notes", { id: nota.id, title: "Hooks" })
  expect((await store.note(nota.id)).title).toBe("Hooks")
})

test("el snapshot trae las notas SIN content; el cuerpo se pide por id", async () => {
  const curso = await seedCourse()
  await store.save("notes", { course_id: curso.id, position: 0, title: "Con cuerpo" })

  const [ref] = (await store.snapshot()).notes
  expect(ref).not.toHaveProperty("content")
  expect(ref.title).toBe("Con cuerpo")
  expect(await store.note(ref.id)).toHaveProperty("content")
})

test("borrar es soft delete: sale del snapshot pero la fila sigue en localStorage", async () => {
  const curso = await seedCourse()
  const nota = await store.save("notes", { course_id: curso.id, position: 0 })

  await store.softDelete("notes", nota.id)

  expect((await store.snapshot()).notes).toEqual([])
  // ADR 0002: la app nunca hace DELETE. La fila tiene que seguir ahí, con deleted_at.
  const raw = JSON.parse(localStorage.getItem("bita-local:notes")!)
  expect(raw).toHaveLength(1)
  expect(raw[0].deleted_at).toEqual(expect.any(String))
})

test("archivar un curso no toca sus notas", async () => {
  const curso = await seedCourse()
  await store.save("notes", { course_id: curso.id, position: 0 })

  await store.softDelete("courses", curso.id)

  const snap = await store.snapshot()
  expect(snap.courses).toEqual([])
  expect(snap.notes).toHaveLength(1)
})

test("los defaults de la tabla los pone el adapter, igual que Postgres", async () => {
  const curso = await seedCourse()
  expect(curso).toMatchObject({ status: "active", imported: false, icon: null, deleted_at: null })
})

test("read_log es append-only y guarda el grade de la flashcard", async () => {
  const curso = await seedCourse()
  const nota = await store.save("notes", { course_id: curso.id, position: 0 })

  await store.save("read_log", { note_id: nota.id })
  await store.save("read_log", { note_id: nota.id, grade: "correcto" })

  expect((await store.snapshot()).reads).toEqual([
    { note_id: nota.id, read_at: expect.any(String), grade: null },
    { note_id: nota.id, read_at: expect.any(String), grade: "correcto" },
  ])
})

test("habit_log se escribe por clave natural (habit_id, day): dos veces el mismo día es UNA fila", async () => {
  await store.save("habits", { name: "Gym", metric: "count", target: 3, period: "week" })
  const [habito] = (await store.snapshot()).habits

  await store.save("habit_log", { habit_id: habito.id, day: "2026-08-25", amount: 1, target: 3 })
  await store.save("habit_log", { habit_id: habito.id, day: "2026-08-25", amount: 2, target: 3 })

  expect((await store.snapshot()).habitLog).toEqual([
    { habit_id: habito.id, day: "2026-08-25", amount: 2, target: 3 },
  ])
})

test("el adapter escribe el target que le dan — no lo decide él", async () => {
  // Quién congela el target es `derive.frozenTarget`, del lado del llamador. El adapter no opina:
  // si opinara, tendría que opinar igual que el de Supabase, y antes no lo hacía.
  await store.save("habits", { name: "Gym", metric: "count", target: 3, period: "week" })
  const [habito] = (await store.snapshot()).habits

  await store.save("habit_log", { habit_id: habito.id, day: "2026-08-25", amount: 1, target: 3 })
  await store.save("habit_log", { habit_id: habito.id, day: "2026-08-25", amount: 2, target: 99 })

  expect((await store.snapshot()).habitLog[0].target).toBe(99)
})

test("desmarcar deja la fila en cero, no la borra", async () => {
  await store.save("habits", { name: "Meditar" })
  const [habito] = (await store.snapshot()).habits
  await store.save("habit_log", { habit_id: habito.id, day: "2026-08-25", amount: 1, target: 1 })
  await store.save("habit_log", { habit_id: habito.id, day: "2026-08-25", amount: 0, target: 1 })

  expect((await store.snapshot()).habitLog).toEqual([
    { habit_id: habito.id, day: "2026-08-25", amount: 0, target: 1 },
  ])
})

test("generar flashcards no está disponible sin backend, y lo dice antes de intentarlo", async () => {
  expect(store.canGenerateFlashcards).toBe(false)
  await expect(store.generateFlashcards("c1")).rejects.toThrow(/Supabase/)
})

test("sin env de Supabase, salir del modo local avisa que no hay a dónde ir", async () => {
  // Antes esto llamaba a setStorageMode('supabase') y recargaba: la app volvía a caer en local
  // (no hay env) y el usuario veía un reload que no hacía nada.
  expect(await store.auth.signOut()).toBe(false)
})

test("un localStorage corrupto no rompe la app: se lee como vacío", async () => {
  localStorage.setItem("bita-local:courses", "{ esto no es JSON")
  expect((await store.snapshot()).courses).toEqual([])
})
