import { localStore } from "@/core/store/local-store"

// El adapter local se testea SIN mocks: localStorage es real (jsdom) y no hay red. Esa es la
// diferencia con el adapter de Supabase, que sólo se puede testear imitando su cliente.

const store = localStore()

beforeEach(() => localStorage.clear())

test("una nota creada se lee de vuelta, y editarla persiste", async () => {
  await store.createCourse({ name: "React" })
  const [curso] = await store.listCourses()

  const nota = await store.createNote(curso.id, 0)
  expect(await store.getNote(nota.id)).toMatchObject({ course_id: curso.id, title: "" })

  await store.updateNote({ id: nota.id, title: "Hooks", content: { type: "doc", content: [] } })
  expect((await store.getNote(nota.id)).title).toBe("Hooks")
  expect(await store.listNotes(curso.id)).toHaveLength(1)
})

test("borrar es soft delete: sale de las listas pero la fila sigue en localStorage", async () => {
  await store.createCourse({ name: "React" })
  const [curso] = await store.listCourses()
  const nota = await store.createNote(curso.id, 0)

  await store.deleteNote(nota.id)

  expect(await store.listNotes(curso.id)).toEqual([])
  expect(await store.listNoteRefs()).toEqual([])
  // ADR 0002: la app nunca hace DELETE. La fila tiene que seguir ahí, con deleted_at.
  const raw = JSON.parse(localStorage.getItem("bita-local:notes")!)
  expect(raw).toHaveLength(1)
  expect(raw[0].deleted_at).toEqual(expect.any(String))
})

test("archivar un curso no toca sus notas", async () => {
  await store.createCourse({ name: "React" })
  const [curso] = await store.listCourses()
  await store.createNote(curso.id, 0)

  await store.deleteCourse(curso.id)

  expect(await store.listCourses()).toEqual([])
  expect(await store.listNotes(curso.id)).toHaveLength(1)
})

test("los cursos se ordenan active → paused → done", async () => {
  await store.createCourse({ name: "Terminado", status: "done" })
  await store.createCourse({ name: "Pausado", status: "paused" })
  await store.createCourse({ name: "Activo", status: "active" })

  expect((await store.listCourses()).map((c) => c.name)).toEqual(["Activo", "Pausado", "Terminado"])
})

test("marcar leído agrega una fila al log y la cola respeta el orden", async () => {
  await store.createCourse({ name: "React" })
  const [curso] = await store.listCourses()
  const a = await store.createNote(curso.id, 0)
  const b = await store.createNote(curso.id, 1)

  // Con las dos sin leer, la cola las trae a las dos.
  expect(await store.reviewQueue()).toHaveLength(2)

  await store.markRead({ noteId: a.id })
  expect(await store.readLog()).toEqual([{ note_id: a.id, read_at: expect.any(String) }])
  // `a` pasa a tener lectura → `b` (nunca leída) queda primera.
  expect((await store.reviewQueue()).map((n) => n.id)).toEqual([b.id, a.id])
})

test("el grade de una flashcard alimenta la retención por curso", async () => {
  await store.createCourse({ name: "React" })
  const [curso] = await store.listCourses()
  const nota = await store.createNote(curso.id, 0)

  await store.markRead({ noteId: nota.id, grade: "correcto" })
  await store.markRead({ noteId: nota.id, grade: "incorrecto" })

  expect(await store.gradedReads()).toEqual([
    { grade: "correcto", course_id: curso.id },
    { grade: "incorrecto", course_id: curso.id },
  ])
  // Un repaso sin grade (nota normal) no entra en el cálculo.
  await store.markRead({ noteId: nota.id })
  expect(await store.gradedReads()).toHaveLength(2)
})

test("registrar un hábito es upsert: dos veces el mismo día es UNA fila", async () => {
  await store.saveHabit({ name: "Gym", metric: "count", target: 3, period: "week" })
  const [habito] = await store.listHabits()

  await store.setHabitDay({ habitId: habito.id, day: "2026-08-25", amount: 1, target: 3 })
  await store.setHabitDay({ habitId: habito.id, day: "2026-08-25", amount: 2, target: 3 })

  expect(await store.habitLog()).toEqual([
    { habit_id: habito.id, day: "2026-08-25", amount: 2, target: 3 },
  ])
})

test("el target de un día ya registrado queda congelado aunque cambie la meta (ADR 0009)", async () => {
  await store.saveHabit({ name: "Gym", metric: "count", target: 3, period: "week" })
  const [habito] = await store.listHabits()
  await store.setHabitDay({ habitId: habito.id, day: "2026-08-25", amount: 1, target: 3 })

  // Sube la meta y vuelve a tocar el MISMO día: el target de esa fila no se reescribe.
  await store.saveHabit({ id: habito.id, name: "Gym", target: 10 })
  await store.setHabitDay({ habitId: habito.id, day: "2026-08-25", amount: 2, target: 10 })

  expect((await store.habitLog())[0].target).toBe(3)
})

test("desmarcar deja la fila en cero, no la borra", async () => {
  await store.saveHabit({ name: "Meditar", metric: "check", target: 1, period: "day" })
  const [habito] = await store.listHabits()
  await store.setHabitDay({ habitId: habito.id, day: "2026-08-25", amount: 1, target: 1 })
  await store.setHabitDay({ habitId: habito.id, day: "2026-08-25", amount: 0, target: 1 })

  expect(await store.habitLog()).toEqual([
    { habit_id: habito.id, day: "2026-08-25", amount: 0, target: 1 },
  ])
})

test("generar flashcards no está disponible sin backend, y lo dice antes de intentarlo", async () => {
  expect(store.canGenerateFlashcards).toBe(false)
  await expect(store.generateFlashcards("c1")).rejects.toThrow(/Supabase/)
})

test("un localStorage corrupto no rompe la app: se lee como vacío", async () => {
  localStorage.setItem("bita-local:courses", "{ esto no es JSON")
  expect(await store.listCourses()).toEqual([])
})
