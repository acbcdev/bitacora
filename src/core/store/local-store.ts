import { hasSupabaseEnv } from "@/core/lib/supabase"
import { setStorageMode } from "@/core/store/mode"
import type { Notebook, Habit, HabitLog, Note, ReadLog } from "@/core/types/database"
import type {
  AuthUser,
  Snapshot,
  Store,
  Writable,
  WriteInput,
  WriteResult,
} from "@/core/store/types"

// Adapter que corre ENTERO en el navegador: sin backend, sin cuenta, sin red. Mismo dominio que
// `supabaseStore`, otro sustrato — y como toda la derivación vive en `derive.ts`, este archivo no
// reimplementa ninguna regla de negocio: lee filas, escribe filas.
//
// Lo que este modo NO es (ADR 0011): no es offline-first ni un sync engine. Es EXCLUYENTE — o
// hablás con Postgres o con el navegador, nunca con los dos. Sin merge, sin conflictos, sin cola
// de escrituras pendientes. Eso es lo que cierra ADR 0004, y sigue cerrado.

const PREFIX = "bita-local:"

// En local no hay auth: un solo usuario, el que tiene el navegador abierto. El id existe sólo
// para que las filas tengan la misma forma que las de Postgres.
const LOCAL_USER_ID = "00000000-0000-0000-0000-000000000000"
const LOCAL_USER: AuthUser = { email: "local" }

// Un icono en modo local se guarda como data URL DENTRO del presupuesto de ~5 MB que comparte con
// las notas. Sin este techo, una foto de 3 MB se come la app entera y el error aparece después,
// al guardar una nota.
const MAX_ICON_BYTES = 100_000
// Imagen pegada en una nota (modo local). Más chico que el bucket de Supabase (5MB): una data
// URL es ~4/3 del binario y comparte el presupuesto de ~5 MB con TODO el localStorage.
const MAX_NOTE_IMAGE_BYTES = 500_000

type Tables = {
  notebooks: Notebook
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
    // llegar a Ajustes para cambiar de modo.
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
const live = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => !r.deleted_at)

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => resolve(reader.result as string))
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("No se pudo leer el archivo")),
    )
    reader.readAsDataURL(file)
  })
}

// Los defaults de migrations/0001, replicados: en Supabase los pone Postgres.
const DEFAULTS = {
  notebooks: {
    status: "active",
    started_at: null,
    finished_at: null,
    icon: null,
    source: null,
    area: null,
    imported: false,
  },
  notes: {
    notebook_id: null,
    title: "",
    content: { type: "doc", content: [] },
    kind: "note",
    position: 0,
    imported: false,
  },
  habits: { icon: null, kind: "good", metric: "check", target: 1, period: "day", days: null },
} as const

// Renombre Course → Notebook (migración 0012, ADR 0014): la clave de localStorage y el campo
// de las notas guardadas siguen el nombre nuevo. Copia y borra el viejo. Los dos pasos son
// idempotentes por presencia de clave, así que el flag va al FINAL del try: si algo falla,
// la próxima corrida reintenta.
function maybeMigrateNotebookRename() {
  if (localStorage.getItem("bita-migrated-0012")) return
  try {
    const old = localStorage.getItem(PREFIX + "courses")
    if (old !== null) {
      localStorage.setItem(PREFIX + "notebooks", old)
      localStorage.removeItem(PREFIX + "courses")
    }
    const raw = localStorage.getItem(PREFIX + "notes")
    if (raw) {
      // Filas crudas de localStorage: las pre-0012 traen `course_id`. Sólo se tocan esas —
      // re-corridas (el flag vive en localStorage y un clear lo borra) no deben alterar filas
      // ya migradas.
      const notes = JSON.parse(raw) as Record<string, unknown>[]
      if (notes.some((n) => "course_id" in n)) {
        localStorage.setItem(
          PREFIX + "notes",
          JSON.stringify(
            notes.map((n) =>
              "course_id" in n ? { ...n, notebook_id: n.course_id, course_id: undefined } : n,
            ),
          ),
        )
      }
    }
    localStorage.setItem("bita-migrated-0012", "1")
  } catch (err) {
    // Sin flag: la próxima corrida reintenta (los dos pasos son idempotentes por presencia de clave).
    console.error("migración 0012 (local) falló — se reintenta en el próximo arranque", err)
  }
}

function maybeMigrateTimeToSeconds() {
  if (localStorage.getItem("bita-migrated-0011")) return
  try {
    const habits = read("habits") as Habit[]
    const timeIds = new Set<string>()
    for (const h of habits) if (h.metric === "time") timeIds.add(h.id)
    if (timeIds.size === 0) {
      localStorage.setItem("bita-migrated-0011", "1")
      return
    }
    let touched = false
    for (const h of habits) {
      if (h.metric === "time" && h.target < 6000) {
        // target en minutos (<100h) → segundos. Después de migrar son >60, y con flag no re-entra.
        h.target *= 60
        touched = true
      }
    }
    if (touched) write("habits", habits as never)

    const logs = read("habit_log") as HabitLog[]
    let logTouched = false
    for (const r of logs) {
      if (timeIds.has(r.habit_id as string) && r.amount < 100000) {
        // amount/target en minutos → segundos. 25 min = 25 vs 1500s, se distingue por ser < 6000.
        // Un hábito nuevo post-migración ya viene en segundos (1500) pero el flag evita doble.
        r.amount *= 60
        r.target *= 60
        logTouched = true
      }
    }
    if (logTouched) write("habit_log", logs as never)
  } catch (err) {
    // Sin flag: la próxima corrida reintenta. Corrompido no bloquea el arranque (ADR 0011).
    console.error("migración 0011 (local) falló — se reintenta en el próximo arranque", err)
  }
  localStorage.setItem("bita-migrated-0011", "1")
}

export function localStore(): Store {
  maybeMigrateNotebookRename()
  maybeMigrateTimeToSeconds()
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
        // "Cerrar sesión" en local no cierra nada: lo único que puede significar es volver a
        // Supabase. Sin env no hay a dónde volver, y decirlo es mejor que recargar en falso —
        // antes esto recargaba y caía de nuevo en local, sin explicar nada.
        if (!hasSupabaseEnv) return false
        setStorageMode("supabase")
        return true
      },
    },

    // Sólo filas vivas, igual que el adapter de Supabase: el filtro de `deleted_at` es la regla
    // universal de CONTEXT.md y vive de este lado del seam en los dos.
    async snapshot(): Promise<Snapshot> {
      return {
        notebooks: live(read("notebooks")),
        notes: live(read("notes")).map(
          ({ id, title, notebook_id, position, kind, created_at }) => ({
            id,
            title,
            notebook_id,
            position,
            kind,
            created_at,
          }),
        ),
        reads: read("read_log").map(({ note_id, read_at, grade }) => ({ note_id, read_at, grade })),
        habits: live(read("habits")),
        habitLog: read("habit_log").map(({ habit_id, day, amount, target }) => ({
          habit_id,
          day,
          amount,
          target,
        })),
      }
    },

    async note(id) {
      const found = read("notes").find((n) => n.id === id && !n.deleted_at)
      // Mismo comportamiento que `.single()` de PostgREST: sin fila, error.
      if (!found) throw new Error("Nota no encontrada")
      return found
    },

    async save<E extends Writable>(entity: E, input: WriteInput[E]): Promise<WriteResult[E]> {
      const { id, ...values } = input as { id?: string } & Record<string, unknown>

      // habit_log se identifica por su clave natural (habit_id, day), no por id — el unique de la
      // migración 0010. La fila llega completa, con el `target` ya congelado por quien llama.
      if (entity === "habit_log") {
        const rows = read("habit_log")
        // SAFETY: el llamador (frozenTarget / HabitDayInput) garantiza habit_id+day+amount+target
        // completos; TS no lo ve porque WriteInput[E] se resuelve en runtime.
        const v = values as unknown as Omit<HabitLog, "id" | "user_id">
        const i = rows.findIndex((r) => r.habit_id === v.habit_id && r.day === v.day)
        const row = { ...v, id: rows[i]?.id ?? crypto.randomUUID(), user_id: LOCAL_USER_ID }
        write("habit_log", i >= 0 ? rows.map((r, j) => (j === i ? row : r)) : [...rows, row])
        return undefined as WriteResult[E]
      }

      if (entity === "read_log") {
        // Append-only: un repaso es un hecho absoluto, no se edita ni se borra.
        write("read_log", [
          ...read("read_log"),
          {
            id: crypto.randomUUID(),
            user_id: LOCAL_USER_ID,
            grade: null,
            read_at: now(),
            ...values,
          } as ReadLog,
        ])
        return undefined as WriteResult[E]
      }

      const table = entity as "notebooks" | "notes" | "habits"
      const rows = read(table)

      if (id) {
        write(
          table,
          rows.map((r) => (r.id === id ? { ...r, ...values } : r)),
        )
        return undefined as WriteResult[E]
      }

      const row = {
        id: crypto.randomUUID(),
        user_id: LOCAL_USER_ID,
        ...DEFAULTS[table],
        ...values,
        deleted_at: null,
        created_at: now(),
      } as Tables[typeof table]
      write(table, [...rows, row])
      // Sólo `notes` devuelve la fila (ADR 0008); el resto no la necesita.
      return (entity === "notes" ? row : undefined) as WriteResult[E]
    },

    // Soft delete (ADR 0002): la fila nunca sale del array, se le pone `deleted_at`. Si acá se
    // borrara de verdad, los dos adapters dejarían de significar lo mismo.
    async softDelete(entity, id) {
      write(
        entity,
        read(entity).map((row) => (row.id === id ? { ...row, deleted_at: now() } : row)),
      )
    },

    async uploadNotebookIcon(file) {
      if (file.size > MAX_ICON_BYTES) {
        throw new Error(
          `En modo local el icono se guarda en el navegador: máximo ${MAX_ICON_BYTES / 1000} KB.`,
        )
      }
      // Data URL y no un bucket: es la única forma de que la imagen sobreviva a un reload sin
      // servidor. `notebook-icon.tsx` ya trata cualquier cosa que no empiece con 'lucide:' como
      // imagen, así que una data URL entra por esa rama sin cambios.
      return fileToDataUrl(file)
    },

    // Imagen de nota en localStorage como data URL — mismo tradeoff que los iconos
    // (MAX_ICON_BYTES): una data URL es ~4/3 del binario y usa el mismo presupuesto de
    // ~5 MB que TODO el localStorage. 1 MB por imagen lo rompe igual.
    // ponytail: sync porque fileToDataUrl ya devuelve la Promise — envolverla de nuevo no agrega nada.
    uploadNoteImage(file: File) {
      if (file.size > MAX_NOTE_IMAGE_BYTES) {
        throw new Error(
          `En modo local la imagen se guarda en el navegador: máximo ${MAX_NOTE_IMAGE_BYTES / 1000} KB. Usá Supabase en Ajustes para imágenes grandes.`,
        )
      }
      return fileToDataUrl(file)
    },

    async generateFlashcards() {
      // No es "todavía no implementado": no hay dónde correr la llamada a Anthropic ni dónde
      // guardar la key sin backend (ADR 0010). `canGenerateFlashcards` deja que la UI lo esconda;
      // esto es la red por si alguien igual llega hasta acá.
      throw new Error("Generar flashcards necesita Supabase — no corre en modo local.")
    },
  }
}
