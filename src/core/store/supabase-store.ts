import { getSupabase } from "@/core/lib/supabase"
import type { Course, CourseStatus, Grade, Habit, Note, TiptapDoc } from "@/core/types/database"
import type { GradedRead, NoteRef, ReadRow, Store } from "@/core/store/types"

// Adapter contra Supabase — el default (CONTEXT.md: "Stack cerrado"). Todo lo que antes vivía
// desparramado en los seis `*.api.ts` está acá; los hooks quedaron con React Query y nada más.
// Ninguna decisión de la capa remota cambió: mismas RPC, mismo soft delete, mismo upsert.

const STATUS_ORDER: Record<CourseStatus, number> = { active: 0, paused: 1, done: 2 }

function answerDoc(answer: string): TiptapDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: answer }] }],
  }
}

export function supabaseStore(): Store {
  return {
    mode: "supabase",
    // La Edge Function `generate-flashcards` sólo existe de este lado (ADR 0010).
    canGenerateFlashcards: true,

    auth: {
      async getUser() {
        const { data } = await getSupabase().auth.getSession()
        return data.session ? { email: data.session.user.email ?? "" } : null
      },
      onChange(cb) {
        const { data } = getSupabase().auth.onAuthStateChange((_e, session) =>
          cb(session ? { email: session.user.email ?? "" } : null),
        )
        return () => data.subscription.unsubscribe()
      },
      async signIn(email) {
        const { error } = await getSupabase().auth.signInWithOtp({ email })
        if (error) throw error
      },
      async signOut() {
        await getSupabase().auth.signOut()
      },
    },

    // RPC `courses_page` (migración 0006, afinada hasta 0009): búsqueda, filtro, orden, rondas y
    // último repaso resueltos en Postgres. El cliente no agrega nada.
    async coursesPage({ q, status, sort, page, pageSize }) {
      const { data, error } = await getSupabase().rpc("courses_page", {
        q,
        status_filter: status === "todos" ? null : status,
        sort,
        page_size: pageSize,
        page_offset: (page - 1) * pageSize,
      })
      if (error) throw error
      // total_count viaja repetido en cada fila; sin filas, no hay resultados.
      return { rows: data, total: data[0]?.total_count ?? 0 }
    },

    // Orden estable: active → paused → done, luego más nuevo primero. Datos chicos → se ordena en
    // JS (Postgres no ordena por prioridad de enum sin CASE).
    async listCourses(): Promise<Course[]> {
      const { data, error } = await getSupabase().from("courses").select("*").is("deleted_at", null)
      if (error) throw error
      return data.toSorted(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          b.created_at.localeCompare(a.created_at),
      )
    },

    async createCourse(input) {
      const { error } = await getSupabase().from("courses").insert(input) // user_id: default auth.uid()
      if (error) throw error
    },

    async updateCourse(id, input) {
      const { error } = await getSupabase().from("courses").update(input).eq("id", id)
      if (error) throw error
    },

    // Soft delete: set deleted_at. NUNCA DELETE (ADR 0002). No toca las notas del curso.
    async deleteCourse(id) {
      const { error } = await getSupabase()
        .from("courses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },

    // La carpeta tiene que ser el user_id: es lo que exige la policy de storage (migración 0004).
    // El tipo y el tamaño los valida el bucket.
    async uploadCourseIcon(file) {
      const supabase = getSupabase()
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError || !data.user) throw authError ?? new Error("Sin sesión")
      // Sin extensión: el content-type lo guarda storage, y así no hay que sanear `file.name`.
      const path = `${data.user.id}/${crypto.randomUUID()}`
      const { error } = await supabase.storage.from("course-icons").upload(path, file)
      if (error) throw error
      return supabase.storage.from("course-icons").getPublicUrl(path).data.publicUrl
    },

    async listNotes(courseId): Promise<Note[]> {
      const { data, error } = await getSupabase()
        .from("notes")
        .select("*")
        .eq("course_id", courseId)
        .eq("kind", "note")
        .is("deleted_at", null)
        .order("position", { ascending: true })
      if (error) throw error
      return data
    },

    // Sin `content`: ~1.500 filas de título son baratas, las mismas con el documento Tiptap no.
    async listNoteRefs(): Promise<NoteRef[]> {
      const { data, error } = await getSupabase()
        .from("notes")
        .select("id, title, course_id, position")
        .eq("kind", "note")
        .is("deleted_at", null)
        .order("position", { ascending: true })
      if (error) throw error
      return data
    },

    async getNote(id): Promise<Note> {
      const { data, error } = await getSupabase()
        .from("notes")
        .select("*")
        .eq("id", id)
        .eq("kind", "note")
        .is("deleted_at", null)
        .single()
      if (error) throw error
      return data
    },

    // Devuelve la fila entera para navegar al editor sin volver a pedirla — un solo roundtrip en
    // todo el flujo (ADR 0008).
    async createNote(courseId, position): Promise<Note> {
      const { data, error } = await getSupabase()
        .from("notes")
        .insert({ course_id: courseId, position, content: { type: "doc", content: [] } })
        .select("*") // la fila entera sale gratis en el mismo request
        .single()
      if (error) throw error
      return data
    },

    async updateNote({ id, title, content }) {
      const { error } = await getSupabase().from("notes").update({ title, content }).eq("id", id)
      if (error) throw error
    },

    async deleteNote(id) {
      const { error } = await getSupabase()
        .from("notes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },

    // RPC `review_queue()` (migración 0003): notas de cursos vivos, más viejas primero
    // (nunca-leídas primero), limit 3.
    async reviewQueue(): Promise<Note[]> {
      const { data, error } = await getSupabase().rpc("review_queue")
      if (error) throw error
      return data
    },

    // Exactamente una fila en read_log. NUNCA se borra. `grade` sólo si es flashcard.
    async markRead({ noteId, grade }: { noteId: string; grade?: Grade }) {
      const { error } = await getSupabase().from("read_log").insert({ note_id: noteId, grade })
      if (error) throw error
    },

    async readLog(): Promise<ReadRow[]> {
      const { data, error } = await getSupabase().from("read_log").select("note_id, read_at")
      if (error) throw error
      return data
    },

    async gradedReads(): Promise<GradedRead[]> {
      const { data, error } = await getSupabase()
        .from("read_log")
        .select("grade, note:notes(course_id)")
        .not("grade", "is", null)
      if (error) throw error
      const rows = data as unknown as { grade: Grade; note: { course_id: string | null } | null }[]
      return rows.map((r) => ({ grade: r.grade, course_id: r.note?.course_id ?? null }))
    },

    // Edge Function + insert de cada par como nota `kind: 'flashcard'` — mismo shape que una nota
    // normal, sin tabla nueva (ADR 0010).
    async generateFlashcards(courseId) {
      const supabase = getSupabase()
      const { data, error } = await supabase.functions.invoke<{
        flashcards: { question: string; answer: string }[]
      }>("generate-flashcards", { body: { course_id: courseId } })
      if (error) throw error
      const pairs = data?.flashcards ?? []
      if (pairs.length === 0) return
      const { error: insertError } = await supabase.from("notes").insert(
        pairs.map((p) => ({
          course_id: courseId,
          kind: "flashcard" as const,
          title: p.question,
          content: answerDoc(p.answer),
        })),
      )
      if (insertError) throw insertError
    },

    // Orden de creación: es el de la tira y el del chord h>1..9. Si algo lo reordenara, h>2 sería
    // otro hábito según el día.
    async listHabits(): Promise<Habit[]> {
      const { data, error } = await getSupabase()
        .from("habits")
        .select("*")
        .is("deleted_at", null)
        .order("created_at")
      if (error) throw error
      return data
    },

    async habitLog() {
      const { data, error } = await getSupabase()
        .from("habit_log")
        .select("habit_id, day, amount, target")
      if (error) throw error
      return data
    },

    // Upsert sobre (habit_id, day), no un diff. `amount = 0` deja la fila en cero: no se borra nada.
    async setHabitDay({ habitId, day, amount, target }) {
      const { error } = await getSupabase()
        .from("habit_log")
        .upsert({ habit_id: habitId, day, amount, target }, { onConflict: "habit_id,day" })
      if (error) throw error
    },

    // Alta y edición en la misma operación: el form del dialog es el mismo con y sin `id`.
    async saveHabit({ id, ...input }) {
      const supabase = getSupabase()
      const { error } = id
        ? await supabase.from("habits").update(input).eq("id", id)
        : await supabase.from("habits").insert(input) // user_id: default auth.uid()
      if (error) throw error
    },

    // Archivar = soft delete. El habit_log queda intacto.
    async archiveHabit(id) {
      const { error } = await getSupabase()
        .from("habits")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
  }
}
