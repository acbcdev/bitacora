import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { store } from "@/core/store"
import type { Note, TiptapDoc } from "@/core/types/database"

const EMPTY_DOC: TiptapDoc = { type: "doc", content: [] }

export type { NoteRef } from "@/core/store/types"

// Notas vivas de un curso, en orden de position.
export function useNotes(courseId: string) {
  return useQuery({ queryKey: ["notes", courseId], queryFn: () => store.listNotes(courseId) })
}

// Índice liviano de todas las notas (sin content): lo usan la command palette y el "últ. repaso"
// por curso. ~1.500 filas de título — barato, y evita 59 queries por curso.
export function useAllNoteRefs() {
  return useQuery({ queryKey: ["note_refs"], queryFn: () => store.listNoteRefs() })
}

// Una nota por id. Puede tener course_id null (curso borrado) — la UI no debe romper.
export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: ["note", id],
    enabled: !!id,
    queryFn: () => store.getNote(id!),
  })
}

// Crea nota al final del curso (position = max+1). Devuelve la fila entera para navegar al editor
// sin volver a pedirla. Un solo roundtrip en todo el flujo — ver ADR 0008.
export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (courseId: string): Promise<Note> => {
      // El SELECT del último position sobra: la lista del curso ya está en cache (useNotes corre
      // al entrar). Sin cache el fallback es 0 — solo pasaría llamando esto fuera de la pantalla
      // Curso, que hoy no ocurre. Colisión de position = orden ambiguo entre dos notas, no error
      // (no hay unique constraint), así que tampoco hace falta blindarlo.
      const cached = qc.getQueryData<Note[]>(["notes", courseId]) ?? []
      const position = Math.max(-1, ...cached.map((n) => n.position)) + 1
      return store.createNote(courseId, position)
    },
    onSuccess: (note, courseId) => {
      // Sembrar, no invalidar: la fila la acaba de mandar el server, pedirla otra vez es preguntar
      // dos veces lo mismo. Sin esto el editor monta con NoteSkeleton (useNote) y —peor— el efecto
      // de auto-corrección de URL de Course no encuentra la nota en la lista vieja y te rebota a la
      // primera del curso.
      qc.setQueryData(["note", note.id], note)
      qc.setQueryData<Note[]>(["notes", courseId], (old = []) => [...old, note])
      // Refetch de fondo, para reconciliar cambios de otro device. Sin `return`: devolver la
      // promesa haría que TanStack la espere antes del onSuccess del mutate() — o sea el navigate
      // esperaría al refetch (medido: 372ms sobre 400ms de latencia).
      qc.invalidateQueries({ queryKey: ["notes", courseId] })
    },
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; title: string; content: TiptapDoc }) =>
      store.updateNote(input),
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
    // El doc en vivo, no el de la query: entre keystroke y autosave (800ms) `note.content`
    // está atrasado. Lo consume NoteActions para copiar/exportar markdown.
    getDoc: () => doc.current,
  }
}

// Soft delete (ADR 0002). Nunca DELETE.
export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => store.deleteNote(id),
    onSuccess: () => {
      toast.success("Nota borrada")
      qc.invalidateQueries({ queryKey: ["notes"] })
    },
  })
}
