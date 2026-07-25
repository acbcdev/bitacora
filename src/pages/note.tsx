import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Editor } from "@/components/Editor"
import { useDeleteNote, useNote, useUpdateNote } from "@/lib/notes"
import { downloadMarkdown } from "@/lib/tiptap-markdown"
import type { TiptapDoc } from "@/types/database"

// Pantalla Nota (screen 3): editor Tiptap. Autosave debounced — keyboard-first, sin botón guardar.
export function Note() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: note, isLoading } = useNote(id)
  const update = useUpdateNote()
  const del = useDeleteNote()

  const [title, setTitle] = useState("")
  const doc = useRef<TiptapDoc>({ type: "doc", content: [] })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      doc.current = note.content
    }
  }, [note])

  function save() {
    if (id) update.mutate({ id, title, content: doc.current })
  }
  function scheduleSave() {
    clearTimeout(timer.current)
    timer.current = setTimeout(save, 800)
  }

  if (isLoading) return null
  if (!note) return <p className="p-8 text-muted-foreground">Nota no encontrada.</p>

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/courses" className="text-sm text-muted-foreground hover:underline">
          ← Cursos
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => downloadMarkdown(title, doc.current)}
            className="rounded border px-3 py-1 text-sm hover:bg-accent"
          >
            Export .md
          </button>
          <button
            onClick={() =>
              id && confirm("¿Borrar nota?") && del.mutate(id, { onSuccess: () => navigate("/courses") })
            }
            className="rounded border px-3 py-1 text-sm text-destructive hover:bg-accent"
          >
            Borrar
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          scheduleSave()
        }}
        onBlur={save}
        placeholder="Título"
        className="mb-2 w-full bg-transparent text-2xl font-bold outline-none"
      />

      <Editor
        content={note.content}
        onChange={(d) => {
          doc.current = d
          scheduleSave()
        }}
      />
    </div>
  )
}
