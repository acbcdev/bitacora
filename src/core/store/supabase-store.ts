import { getSupabase } from "@/core/lib/supabase"
import type { Note, TiptapDoc } from "@/core/types/database"
import type { Snapshot, Store, WriteInput, WriteResult, Writable } from "@/core/store/types"

// Adapter contra Supabase — el default (CONTEXT.md, "Stack cerrado").
//
// Ya no llama a las RPC `courses_page` ni `review_queue`: la derivación vive en `derive.ts` y la
// comparten los dos adapters (ADR 0011). Las funciones siguen en la DB, sin llamador — retirarlas
// es una migración, y una migración es un cambio de DB.
//
// Lo que sí sigue igual: RLS aplica (`supabase-js` habla PostgREST directo, sin ORM — ADR 0006),
// el borrado es lógico (ADR 0002) y read_log es append-only.

function answerDoc(answer: string): TiptapDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: answer }] }],
  }
}

export function supabaseStore(): Store {
  return {
    mode: "supabase",
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
        return true
      },
    },

    // Las cinco tablas vivas en paralelo. Cinco requests que salen juntos y llegan juntos: en la
    // versión anterior eran seis queries encadenadas a lo largo del arranque, cada una con su
    // propio waterfall de React Query.
    async snapshot(): Promise<Snapshot> {
      const supabase = getSupabase()
      const [courses, notes, reads, habits, habitLog] = await Promise.all([
        supabase.from("courses").select("*").is("deleted_at", null),
        // Sin `content`: es el 99% del peso y sólo lo necesita la nota abierta.
        supabase
          .from("notes")
          .select("id, title, course_id, position, kind, created_at")
          .is("deleted_at", null),
        supabase.from("read_log").select("note_id, read_at, grade"),
        supabase.from("habits").select("*").is("deleted_at", null),
        supabase.from("habit_log").select("habit_id, day, amount, target"),
      ])
      const failed = [courses, notes, reads, habits, habitLog].find((r) => r.error)
      if (failed?.error) throw failed.error
      return {
        courses: courses.data ?? [],
        notes: notes.data ?? [],
        reads: reads.data ?? [],
        habits: habits.data ?? [],
        habitLog: habitLog.data ?? [],
      }
    },

    async note(id): Promise<Note> {
      const { data, error } = await getSupabase()
        .from("notes")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single()
      if (error) throw error
      return data
    },

    async save<E extends Writable>(entity: E, input: WriteInput[E]): Promise<WriteResult[E]> {
      const supabase = getSupabase()
      const { id, ...row } = input as { id?: string } & Record<string, unknown>

      if (entity === "habit_log") {
        // Upsert sobre la clave natural (habit_id, day) — el unique de la migración 0010.
        // La fila llega completa, con el `target` ya congelado por `derive.frozenTarget`.
        const { error } = await supabase
          .from("habit_log")
          .upsert(row as never, { onConflict: "habit_id,day" })
        if (error) throw error
        return undefined as WriteResult[E]
      }

      // Sólo `notes` devuelve la fila: el editor navega a la nota nueva sin volver a pedirla
      // (ADR 0008). La fila entera sale gratis en el mismo request.
      if (entity === "notes" && !id) {
        const { data, error } = await supabase
          .from("notes")
          .insert(row as never)
          .select("*")
          .single()
        if (error) throw error
        return data as WriteResult[E]
      }

      // Sin `id` es alta y `user_id` lo pone el default `auth.uid()`; con `id`, edición.
      // El cast de la tabla: en tiempo de tipos `entity` es una unión y el cliente no resuelve
      // `.eq("id", …)` contra una unión de Row. Las cuatro tablas tienen `id` y el runtime es
      // idéntico — acotarlo acá evita cuatro ramas que harían exactamente lo mismo.
      const table = supabase.from(entity as "courses")
      const { error } = id
        ? await table.update(row as never).eq("id", id)
        : await table.insert(row as never)
      if (error) throw error
      return undefined as WriteResult[E]
    },

    // Borrado lógico: nunca DELETE (ADR 0002). Borrar un curso no toca sus notas.
    async softDelete(entity, id) {
      const { error } = await getSupabase()
        .from(entity)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },

    // La carpeta tiene que ser el user_id: es lo que exige la policy de storage (migración 0004).
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
  }
}
