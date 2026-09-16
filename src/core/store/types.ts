import type {
  Notebook,
  Grade,
  Habit,
  HabitLog,
  Note,
  NoteKind,
  TiptapDoc,
} from "@/core/types/database"

// El seam de datos. Seis métodos, no veintidós.
//
// La primera versión tenía un método por query (`notebooksPage`, `listNotes`, `readLog`,
// `gradedReads`, …): 22 métodos con 22 call sites, uno a uno. Eso no era una abstracción sino
// una transliteración — el ancho de la interfaz era igual a la superficie de implementación, que
// es la definición de módulo shallow.
//
// Ahora el adapter hace UNA sola cosa: traer las filas vivas y escribirlas. Todo lo derivado
// —página de notebooks, cola de repaso, retención, racha— son funciones puras sobre el `Snapshot`
// (`derive.ts`), y las comparten los dos adapters. Agregar una pantalla nueva ya no agranda el
// seam: agrega una función pura.

export type StorageMode = "supabase" | "local"

// El tipo de sesión de la app. No el `Session` de @supabase/supabase-js, que traía 40 campos
// para que se leyera uno.
export type AuthUser = { email: string }

// Una nota SIN `content`. El documento Tiptap es el 99% del peso de la fila y no se necesita para
// listar, ordenar ni armar la cola — sólo para renderizar la nota abierta, que se pide aparte con
// `note(id)`. A ~1.500 notas, mandar el content en el snapshot serían megas por cada arranque.
export type NoteRef = Pick<
  Note,
  "id" | "title" | "notebook_id" | "position" | "kind" | "created_at"
>

// Una fila cruda de read_log. `grade` sólo viene completo en flashcards.
export type ReadRow = { note_id: string; read_at: string; grade: Grade | null }

export type HabitLogRow = Pick<HabitLog, "habit_id" | "day" | "amount" | "target">

// Todo lo que la app necesita para pintar cualquier pantalla, menos el cuerpo de las notas.
//
// Sólo filas VIVAS: el adapter ya filtró `deleted_at is null`, que es la regla universal de
// CONTEXT.md ("Toda query filtra deleted_at is null"). Por eso ninguna función de `derive.ts`
// vuelve a chequear `deleted_at` — si tuviera que hacerlo, la regla estaría en dos lados.
//
// Cabe de sobra en el cliente: CONTEXT.md, "los datos son CHICOS" — 59 notebooks, ~1.500 títulos,
// ~1k filas de read_log al año. `useReadStats` y `useHabitLog` ya se bajaban su tabla entera y
// agregaban en JS; esto es esa decisión, aplicada parejo.
export type Snapshot = {
  notebooks: Notebook[]
  notes: NoteRef[]
  reads: ReadRow[]
  habits: Habit[]
  habitLog: HabitLogRow[]
}

export const EMPTY_SNAPSHOT: Snapshot = {
  notebooks: [],
  notes: [],
  reads: [],
  habits: [],
  habitLog: [],
}

// Las tablas a las que se escribe. `read_log` no está en `SoftDeletable` a propósito: es
// append-only, un repaso es un hecho absoluto (CONTEXT.md). `habit_log` tampoco: desmarcar es
// `amount = 0`, no borrar (ADR 0009).
export type Writable = "notebooks" | "notes" | "read_log" | "habits" | "habit_log"
export type SoftDeletable = "notebooks" | "notes" | "habits"

export type NotebookInput = {
  id?: string
  name?: string
  status?: Notebook["status"]
  started_at?: string | null
  finished_at?: string | null
  icon?: string | null
  source?: string | null
  area?: string | null
}

export type NoteInput = {
  id?: string
  notebook_id?: string | null
  title?: string
  content?: TiptapDoc
  kind?: NoteKind
  position?: number
}

export type HabitInput = {
  id?: string
  name?: string
  icon?: string | null
  kind?: Habit["kind"]
  metric?: Habit["metric"]
  target?: number
  period?: Habit["period"]
  days?: number[] | null
}

// La fila de habit_log se escribe COMPLETA, con el `target` ya resuelto por quien llama
// (`frozenTarget` en derive.ts). El adapter no decide nada: escribe lo que le dan.
// Antes cada adapter resolvía el congelado por su cuenta y los dos no coincidían.
export type HabitDayInput = { habit_id: string; day: string; amount: number; target: number }

export type WriteInput = {
  notebooks: NotebookInput
  notes: NoteInput
  read_log: { note_id: string; grade?: Grade | null }
  habits: HabitInput
  habit_log: HabitDayInput
}

// Sólo `notes` devuelve la fila: el editor navega a la nota recién creada sin volver a pedirla
// (ADR 0008). El resto no la necesita y devolverla sería trabajo de más.
export type WriteResult = {
  notebooks: void
  notes: Note
  read_log: void
  habits: void
  habit_log: void
}

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
    // Devuelve true si efectivamente se salió. En local sin env de Supabase no hay a dónde ir.
    signOut(): Promise<boolean>
  }

  snapshot(): Promise<Snapshot>
  note(id: string): Promise<Note>
  save<E extends Writable>(entity: E, input: WriteInput[E]): Promise<WriteResult[E]>
  softDelete(entity: SoftDeletable, id: string): Promise<void>

  uploadNotebookIcon(file: File): Promise<string>
  // Imagen pegada en el editor de notas: URL pública (Supabase, bucket 'notes-images') o data
  // URL (local). Tira Error con mensaje en español — el editor lo muestra con toast.
  uploadNoteImage(file: File): Promise<string>
  generateFlashcards(notebookId: string): Promise<void>
}
