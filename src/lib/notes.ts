import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Note, TiptapDoc } from "@/types/database"

const EMPTY_DOC: TiptapDoc = { type: "doc", content: [] }

// Notas vivas de un curso, en orden de position.
export function useNotes(courseId: string) {
  return useQuery({
    queryKey: ["notes", courseId],
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("course_id", courseId)
        .is("deleted_at", null)
        .order("position", { ascending: true })
      if (error) throw error
      return data
    },
  })
}

// Una nota por id. Puede tener course_id null (curso borrado) — la UI no debe romper.
export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: ["note", id],
    enabled: !!id,
    queryFn: async (): Promise<Note> => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("id", id!)
        .is("deleted_at", null)
        .single()
      if (error) throw error
      return data
    },
  })
}

// Crea nota al final del curso (position = max+1). Devuelve el id para navegar al editor.
export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (courseId: string): Promise<string> => {
      const { data: last } = await supabase
        .from("notes")
        .select("position")
        .eq("course_id", courseId)
        .is("deleted_at", null)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle()
      const { data, error } = await supabase
        .from("notes")
        .insert({ course_id: courseId, position: (last?.position ?? -1) + 1, content: EMPTY_DOC })
        .select("id")
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: (_id, courseId) => qc.invalidateQueries({ queryKey: ["notes", courseId] }),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title: string; content: TiptapDoc }) => {
      const { error } = await supabase.from("notes").update({ title, content }).eq("id", id)
      if (error) throw error
    },
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: ["note", id] })
      qc.invalidateQueries({ queryKey: ["notes"] })
    },
  })
}

// ponytail: reorder (drag/up-down) no implementado. position se setea al crear (append al final).
// Agregar move-up/down si el orden manual se vuelve necesario — hoy el append alcanza.

// Soft delete (ADR 0002). Nunca DELETE.
export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  })
}
