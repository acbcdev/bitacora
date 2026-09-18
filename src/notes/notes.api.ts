import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { store } from "@/core/store"
import { notebookNotes, noteRefs } from "@/core/store/derive"
import { SNAPSHOT_KEY, useSnapshot, useSnapshotMutation } from "@/core/lib/snapshot"
import type { Note, TiptapDoc } from "@/core/types/database"
import type { NoteRef, Snapshot } from "@/core/store/types"

const EMPTY_DOC: TiptapDoc = { type: "doc", content: [] }

export type { NoteRef } from "@/core/store/types"

// Notas vivas de un notebook, en orden de position. Son refs (sin `content`): la lista muestra
// títulos, y el cuerpo lo trae `useNote` sólo de la nota abierta.
export function useNotes(notebookId: string) {
  return useSnapshot((snap) => notebookNotes(snap, notebookId))
}

// Índice de todas las notas para la command palette y el "últ. repaso" por notebook.
export function useAllNoteRefs() {
  return useSnapshot(noteRefs)
}

// La única lectura que NO sale del snapshot: el documento Tiptap de una nota. Se pide por id y se
// cachea aparte, así abrir una nota no arrastra el content de las otras 1.499.
export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: ["note", id],
    enabled: !!id,
    queryFn: () => store.note(id!),
  })
}

// Crea nota al final del notebook (position = max+1) y devuelve la fila entera para navegar al editor
// sin volver a pedirla — un solo roundtrip en todo el flujo (ADR 0008).
export function useCreateNote() {
  const qc = useQueryClient()
  return useSnapshotMutation(
    async (notebookId: string): Promise<Note> => {
      // El position sale del snapshot que ya está en cache; sin él, 0. Colisión de position =
      // orden ambiguo entre dos notas, no error (no hay unique constraint).
      const snap = qc.getQueryData<Snapshot>(SNAPSHOT_KEY)
      const cached = snap ? notebookNotes(snap, notebookId) : []
      const position = Math.max(-1, ...cached.map((n) => n.position)) + 1
      return store.save("notes", { notebook_id: notebookId, position, content: EMPTY_DOC })
    },
    {
      onSuccess: (note) => {
        // Sembrar, no invalidar (ADR 0008): la fila la acaba de mandar el server. Sin esto el
        // editor monta con NoteSkeleton y —peor— el efecto de auto-corrección de URL de Notebook no
        // encuentra la nota en el snapshot viejo y rebota a la primera del notebook.
        // El refetch del snapshot lo dispara `useSnapshotMutation` sin que nadie lo espere.
        qc.setQueryData(["note", note.id], note)
        qc.setQueryData<Snapshot>(SNAPSHOT_KEY, (snap) =>
          snap ? { ...snap, notes: [...snap.notes, toRef(note)] } : snap,
        )
      },
    },
  )
}

const toRef = ({ id, title, notebook_id, position, kind, created_at }: Note): NoteRef => ({
  id,
  title,
  notebook_id,
  position,
  kind,
  created_at,
})

export function useUpdateNote() {
  const qc = useQueryClient()
  return useSnapshotMutation(
    (input: { id: string; title: string; content: TiptapDoc }) => store.save("notes", input),
    { onSuccess: (_r, { id }) => qc.invalidateQueries({ queryKey: ["note", id] }) },
  )
}

// ponytail: reorder (drag/up-down) no implementado. position se setea al crear (append al final).
// Agregar move-up/down si el orden manual se vuelve necesario — hoy el append alcanza.

// Borrador editable de una nota: título + doc + autosave debounced. Lo comparten la pantalla Nota
// y el panel de edición de la pantalla Notebook — sin botón guardar (keyboard-first).
export function useNoteDraft(id: string | undefined) {
  const { data: note, isLoading } = useNote(id)
  const update = useUpdateNote()
  const [title, setTitle] = useState("")
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const doc = useRef<TiptapDoc>(EMPTY_DOC)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef({ id, title })

  // El ref no se muta durante el render (React puede descartar ese trabajo): se sincroniza
  // post-commit. save() solo corre desde timers/eventos, siempre después del effect.
  useEffect(() => {
    latest.current = { id, title }
  })

  // Reset del draft SOLO al abrir otra nota: keyea al id (ADR 0015), no a la identidad del
  // objeto de la query. Con [note], el refetch del autosave (onSuccess invalida ["note", id])
  // volvía a pisar el tipeo en curso y borraba el "Guardado HH:MM" recién puesto.
  // oxlint-disable react-hooks/exhaustive-deps -- keyea a note?.id por ADR 0015: el draft local
  // es la autoridad dentro de la nota; el server no re-sincroniza post-refetch.
  useEffect(() => {
    if (!note) return
    setTitle(note.title)
    doc.current = note.content
    setSavedAt(null)
  }, [note?.id])
  // oxlint-enable react-hooks/exhaustive-deps

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
  return useSnapshotMutation((id: string) => store.softDelete("notes", id), {
    onSuccess: () => toast.success("Nota borrada"),
  })
}
