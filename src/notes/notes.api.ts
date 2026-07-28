import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { downloadMarkdown } from "@/lib/tiptap-markdown"
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

export type NoteRef = Pick<Note, "id" | "title" | "course_id" | "position">

// Índice liviano de todas las notas (sin content): lo usan la command palette y el "últ. repaso"
// por curso. ~1.500 filas de título — barato, y evita 59 queries por curso.
export function useAllNoteRefs() {
  return useQuery({
    queryKey: ["note_refs"],
    queryFn: async (): Promise<NoteRef[]> => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, course_id, position")
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
    mutationFn: async ({
      id,
      title,
      content,
    }: {
      id: string
      title: string
      content: TiptapDoc
    }) => {
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

// Borrador editable de una nota: título + doc + autosave debounced. Lo comparten la pantalla Nota
// y el panel de edición de la pantalla Curso — sin botón guardar (keyboard-first).
export function useNoteDraft(id: string | undefined) {
  const { data: note, isLoading } = useNote(id)
  const update = useUpdateNote()
  const [title, setTitle] = useState("")
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const doc = useRef<TiptapDoc>(EMPTY_DOC)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef({ id, title })
  latest.current = { id, title }

  useEffect(() => {
    if (!note) return
    setTitle(note.title)
    doc.current = note.content
    setSavedAt(null)
  }, [note])

  // Cambiar de nota con un save pendiente perdería el tipeo: cancelar el timer y guardar ya.
  useEffect(() => () => clearTimeout(timer.current), [id])

  function save() {
    const { id: noteId, title: t } = latest.current
    if (!noteId) return
    clearTimeout(timer.current)
    update.mutate(
      { id: noteId, title: t, content: doc.current },
      { onSuccess: () => setSavedAt(new Date().toLocaleTimeString()) },
    )
  }

  function schedule() {
    clearTimeout(timer.current)
    timer.current = setTimeout(save, 800)
  }

  return {
    note,
    isLoading,
    title,
    savedAt,
    save,
    onTitleChange: (t: string) => {
      setTitle(t)
      schedule()
    },
    onDocChange: (d: TiptapDoc) => {
      doc.current = d
      schedule()
    },
    exportMd: () => downloadMarkdown(latest.current.title, doc.current),
  }
}

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
    onSuccess: () => {
      toast.success("Nota borrada")
      qc.invalidateQueries({ queryKey: ["notes"] })
    },
  })
}
