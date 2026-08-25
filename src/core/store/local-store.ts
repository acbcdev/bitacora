import { coursesPage, reviewQueue } from "@/core/store/derive"
import { setStorageMode } from "@/core/store/mode"
import type {
  Course,
  CourseStatus,
  Grade,
  Habit,
  HabitLog,
  Note,
  ReadLog,
} from "@/core/types/database"
import type { AuthUser, GradedRead, NoteRef, ReadRow, Store } from "@/core/store/types"

// Adapter que corre ENTERO en el navegador: sin backend, sin cuenta, sin red. Mismo dominio que
// `supabaseStore`, otro sustrato. Lo que en Supabase resuelven las RPC (`courses_page`,
// `review_queue`) acá lo resuelven las funciones puras de `derive.ts` — la misma semántica escrita
// una sola vez y testeada sin DB.
//
// Lo que este modo NO es (ADR 0011): no es offline-first ni un sync engine. Es EXCLUYENTE — o
// hablás con Postgres o con el navegador, nunca con los dos. Sin merge, sin conflictos, sin cola
// de escrituras pendientes. Eso es lo que ADR 0004 cierra, y sigue cerrado.

const PREFIX = "bita-local:"

// En local no hay auth: un solo usuario, el que tiene el navegador abierto. El id existe sólo
// para que las filas tengan la misma forma que las de Postgres.
const LOCAL_USER_ID = "00000000-0000-0000-0000-000000000000"
const LOCAL_USER: AuthUser = { email: "local" }

// El mismo `limit 3` de la RPC `review_queue` (migración 0003).
const REVIEW_BATCH = 3

// Un icono en modo local se guarda como data URL DENTRO del presupuesto de ~5 MB que comparte con
// las notas. Sin este techo, una foto de 3 MB se come la app entera y el error aparece después,
// al guardar una nota.
const MAX_ICON_BYTES = 100_000

type Tables = {
  courses: Course
  notes: Note
  read_log: ReadLog
  habits: Habit
  habit_log: HabitLog
}

function read<K extends keyof Tables>(table: K): Tables[K][] {
  const raw = localStorage.getItem(PREFIX + table)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Tables[K][]
  } catch {
    // JSON corrupto: devolver [] y no tirar. Tirar acá dejaría la app sin arrancar y sin forma de
    // llegar a Settings para exportar o cambiar de modo.
    return []
  }
}

function write<K extends keyof Tables>(table: K, rows: Tables[K][]) {
  try {
    localStorage.setItem(PREFIX + table, JSON.stringify(rows))
  } catch {
    // QuotaExceededError. Es el único modo de falla real de este adapter y significa perder lo que
    // el usuario acaba de escribir: se avisa con el mensaje que dice qué hacer, no con el del browser.
    throw new Error(
      "Se llenó el almacenamiento del navegador (~5 MB). Borrá notas o cambiá a Supabase en Ajustes.",
    )
  }
}

const now = () => new Date().toISOString()

// Soft delete (ADR 0002): nunca se saca la fila del array, se le pone `deleted_at`. Igual que en
// Postgres — si acá se borrara de verdad, los dos adapters dejarían de significar lo mismo.
function softDelete<K extends "courses" | "notes" | "habits">(table: K, id: string) {
  write(
    table,
    read(table).map((row) => (row.id === id ? { ...row, deleted_at: now() } : row)),
  )
}

const STATUS_ORDER: Record<CourseStatus, number> = { active: 0, paused: 1, done: 2 }

// La forma cruda que consumen las funciones de `derive.ts`. Se lee tres veces (cola, página de
// cursos, stats) y siempre igual.
const readRows = (): ReadRow[] =>
  read("read_log").map(({ note_id, read_at }) => ({ note_id, read_at }))

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => resolve(reader.result as string))
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("No se pudo leer el archivo")),
    )
    reader.readAsDataURL(file)
  })
}

export function localStore(): Store {
  return {
    mode: "local",
    // Generar flashcards necesita la Edge Function con la API key server-side (ADR 0010). Sin
    // backend no hay dónde correrla ni dónde esconder la key: la UI esconde el botón.
    canGenerateFlashcards: false,

    auth: {
      async getUser() {
        return LOCAL_USER
      },
      // Nada externo puede cambiar la sesión local: no hay a qué suscribirse.
      onChange() {
        return () => {}
      },
      async signIn() {
        // No hay a dónde mandar un magic link. En modo local nunca se llega al Login.
      },
      async signOut() {
        // "Cerrar sesión" en local no puede cerrar nada — lo único que significa es salir del modo
        // local y volver a la pantalla de login de Supabase.
        setStorageMode("supabase")
      },
    },

    async coursesPage(query) {
      return coursesPage(read("courses"), read("notes"), readRows(), query)
    },

    async listCourses() {
      return read("courses")
        .filter((c) => !c.deleted_at)
        .toSorted(
          (a, b) =>
            STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
            b.created_at.localeCompare(a.created_at),
        )
    },

    async createCourse(input) {
      write("courses", [
        ...read("courses"),
        {
          id: crypto.randomUUID(),
          user_id: LOCAL_USER_ID,
          name: input.name,
          // Los defaults son los de migrations/0001, replicados: en Supabase los pone Postgres.
          status: input.status ?? "active",
          started_at: input.started_at ?? null,
          finished_at: input.finished_at ?? null,
          icon: input.icon ?? null,
          source: input.source ?? null,
          area: input.area ?? null,
          imported: false,
          deleted_at: null,
          created_at: now(),
        },
      ])
    },

    async updateCourse(id, input) {
      write(
        "courses",
        read("courses").map((c) => (c.id === id ? { ...c, ...input } : c)),
      )
    },

    async deleteCourse(id) {
      softDelete("courses", id)
    },

    async uploadCourseIcon(file) {
      if (file.size > MAX_ICON_BYTES) {
        throw new Error(
          `En modo local el icono se guarda en el navegador: máximo ${MAX_ICON_BYTES / 1000} KB.`,
        )
      }
      // Data URL y no un bucket: es la única forma de que la imagen sobreviva a un reload sin
      // servidor. `course-icon.tsx` ya distingue 'lucide:<Nombre>' de una URL, y una data URL
      // entra por esa segunda rama sin cambios.
      return fileToDataUrl(file)
    },

    async listNotes(courseId) {
      return read("notes")
        .filter((n) => n.course_id === courseId && n.kind === "note" && !n.deleted_at)
        .toSorted((a, b) => a.position - b.position)
    },

    async listNoteRefs(): Promise<NoteRef[]> {
      return read("notes")
        .filter((n) => n.kind === "note" && !n.deleted_at)
        .toSorted((a, b) => a.position - b.position)
        .map(({ id, title, course_id, position }) => ({ id, title, course_id, position }))
    },

    async getNote(id) {
      const note = read("notes").find((n) => n.id === id && n.kind === "note" && !n.deleted_at)
      // Mismo comportamiento que `.single()` de PostgREST: sin fila, error. La pantalla Nota ya
      // sabe mostrar el estado de error.
      if (!note) throw new Error("Nota no encontrada")
      return note
    },

    async createNote(courseId, position) {
      const note: Note = {
        id: crypto.randomUUID(),
        user_id: LOCAL_USER_ID,
        course_id: courseId,
        title: "",
        content: { type: "doc", content: [] },
        kind: "note",
        position,
        imported: false,
        deleted_at: null,
        created_at: now(),
      }
      write("notes", [...read("notes"), note])
      return note
    },

    async updateNote({ id, title, content }) {
      write(
        "notes",
        read("notes").map((n) => (n.id === id ? { ...n, title, content } : n)),
      )
    },

    async deleteNote(id) {
      softDelete("notes", id)
    },

    async reviewQueue() {
      return reviewQueue(read("courses"), read("notes"), readRows(), REVIEW_BATCH)
    },

    // Append-only, igual que en Postgres: un repaso es un hecho absoluto, no se edita ni se borra.
    async markRead({ noteId, grade }) {
      write("read_log", [
        ...read("read_log"),
        {
          id: crypto.randomUUID(),
          user_id: LOCAL_USER_ID,
          note_id: noteId,
          read_at: now(),
          grade: grade ?? null,
        },
      ])
    },

    async readLog(): Promise<ReadRow[]> {
      return readRows()
    },

    // El equivalente del join `read_log → notes(course_id)` que del otro lado hace PostgREST.
    async gradedReads(): Promise<GradedRead[]> {
      const courseOf = new Map(read("notes").map((n) => [n.id, n.course_id]))
      return read("read_log")
        .filter((r): r is ReadLog & { grade: Grade } => r.grade !== null)
        .map((r) => ({ grade: r.grade, course_id: courseOf.get(r.note_id) ?? null }))
    },

    async generateFlashcards() {
      // No es "todavía no implementado": no hay dónde correr la llamada a Anthropic ni dónde
      // guardar la key sin backend (ADR 0010). `canGenerateFlashcards` deja que la UI lo esconda;
      // esto es la red por si alguien igual llega hasta acá.
      throw new Error("Generar flashcards necesita Supabase — no corre en modo local.")
    },

    async listHabits() {
      return read("habits")
        .filter((h) => !h.deleted_at)
        .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
    },

    async habitLog() {
      return read("habit_log").map(({ habit_id, day, amount, target }) => ({
        habit_id,
        day,
        amount,
        target,
      }))
    },

    // Upsert sobre (habit_id, day) — el unique constraint de la migración 0010, a mano.
    async setHabitDay({ habitId, day, amount, target }) {
      const rows = read("habit_log")
      const i = rows.findIndex((r) => r.habit_id === habitId && r.day === day)
      // Si la fila ya existía se respeta SU target: el día vale la meta que regía cuando lo
      // empezaste (ADR 0009).
      if (i >= 0) {
        write(
          "habit_log",
          rows.map((r, j) => (j === i ? { ...r, amount } : r)),
        )
        return
      }
      write("habit_log", [
        ...rows,
        { id: crypto.randomUUID(), user_id: LOCAL_USER_ID, habit_id: habitId, day, amount, target },
      ])
    },

    async saveHabit({ id, ...input }) {
      const rows = read("habits")
      if (id) {
        write(
          "habits",
          rows.map((h) => (h.id === id ? { ...h, ...input } : h)),
        )
        return
      }
      write("habits", [
        ...rows,
        {
          id: crypto.randomUUID(),
          user_id: LOCAL_USER_ID,
          name: input.name,
          icon: input.icon ?? null,
          kind: input.kind ?? "good",
          metric: input.metric ?? "check",
          target: input.target ?? 1,
          period: input.period ?? "day",
          days: input.days ?? null,
          deleted_at: null,
          created_at: now(),
        },
      ])
    },

    async archiveHabit(id) {
      softDelete("habits", id)
    },
  }
}
