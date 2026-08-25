import type {
  Course,
  CourseRow,
  CourseStatus,
  Database,
  Grade,
  Habit,
  HabitLog,
  Note,
  TiptapDoc,
} from "@/core/types/database"

// El seam de datos de la app. Cada método es una operación del DOMINIO (CONTEXT.md), no un
// fragmento de SQL: `reviewQueue()`, no `.from("notes").order(...)`. Eso es lo que lo hace
// implementable dos veces —contra Postgres y contra el browser— y lo que lo vuelve la superficie
// de test: mockear el Store es un objeto plano, mockear supabase-js era un thenable a mano.
//
// Dos adapters, no uno: `supabaseStore` (default) y `localStore`. Ver docs/adr/0011.

export type StorageMode = "supabase" | "local"

// El tipo de sesión de la app. Antes viajaba el `Session` de @supabase/supabase-js —40 campos—
// por el árbol de componentes para leer uno solo.
export type AuthUser = { email: string }

// Parcial a propósito: crear manda nombre + inicio (el resto lo pone el default), y "Finalizar"
// manda solo status + fin.
export type CourseInput = {
  name?: string
  status?: CourseStatus
  started_at?: string | null
  finished_at?: string | null
  icon?: string | null
  source?: string | null
  area?: string | null
}

export type CourseSort = "recientes" | "nombre" | "rondas" | "inicio"

export type CoursesQuery = {
  q: string
  status: CourseStatus | "todos"
  sort: CourseSort
  page: number
  pageSize: number
}

// Índice liviano de notas: sin `content`, que es el 99% del peso de la fila.
export type NoteRef = Pick<Note, "id" | "title" | "course_id" | "position">

// Las dos formas crudas en que se lee `read_log`. Todo lo derivado (racha, rondas, retención)
// sale de acá en JS — ADR 0003, y los datos son chicos (CONTEXT.md).
export type ReadRow = { note_id: string; read_at: string }
export type GradedRead = { grade: Grade; course_id: string | null }

export type HabitLogRow = Pick<HabitLog, "habit_id" | "day" | "amount" | "target">
export type HabitInput = Database["public"]["Tables"]["habits"]["Insert"]

export type SetHabitDay = { habitId: string; day: string; amount: number; target: number }

export type Store = {
  readonly mode: StorageMode
  // Capacidad declarada en vez de sorpresa en runtime: generar flashcards necesita la Edge
  // Function (ADR 0010), que no existe sin backend. La UI pregunta antes de mostrar el botón.
  readonly canGenerateFlashcards: boolean

  auth: {
    getUser(): Promise<AuthUser | null>
    // Devuelve el unsubscribe. En local no hay nada que escuchar: no-op.
    onChange(cb: (user: AuthUser | null) => void): () => void
    signIn(email: string): Promise<void>
    signOut(): Promise<void>
  }

  coursesPage(query: CoursesQuery): Promise<{ rows: CourseRow[]; total: number }>
  listCourses(): Promise<Course[]>
  createCourse(input: CourseInput & { name: string }): Promise<void>
  updateCourse(id: string, input: CourseInput): Promise<void>
  deleteCourse(id: string): Promise<void>
  uploadCourseIcon(file: File): Promise<string>

  listNotes(courseId: string): Promise<Note[]>
  listNoteRefs(): Promise<NoteRef[]>
  getNote(id: string): Promise<Note>
  createNote(courseId: string, position: number): Promise<Note>
  updateNote(input: { id: string; title: string; content: TiptapDoc }): Promise<void>
  deleteNote(id: string): Promise<void>

  reviewQueue(): Promise<Note[]>
  markRead(input: { noteId: string; grade?: Grade }): Promise<void>
  readLog(): Promise<ReadRow[]>
  gradedReads(): Promise<GradedRead[]>

  generateFlashcards(courseId: string): Promise<void>

  listHabits(): Promise<Habit[]>
  habitLog(): Promise<HabitLogRow[]>
  setHabitDay(input: SetHabitDay): Promise<void>
  saveHabit(input: HabitInput & { id?: string }): Promise<void>
  archiveHabit(id: string): Promise<void>
}
