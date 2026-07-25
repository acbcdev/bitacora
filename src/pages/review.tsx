import { useEffect, useState } from "react"
import { Editor } from "@/components/Editor"
import { useCourses } from "@/lib/courses"
import { useReviewQueue, useMarkRead } from "@/lib/review"

// Pantalla Repaso (screen 1) — la que abre 2–3×/día. Keyboard-first:
//   Space = marcar leído (insert read_log) + siguiente · J = saltar sig · K = saltar ant.
export function Review() {
  const { data: queue = [], isLoading, refetch } = useReviewQueue()
  const { data: courses = [] } = useCourses()
  const markRead = useMarkRead()
  const [index, setIndex] = useState(0)

  const note = queue[index]
  const courseName = courses.find((c) => c.id === note?.course_id)?.name

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " ") {
        e.preventDefault() // no scrollear
        if (note) markRead.mutate(note.id)
        setIndex((i) => i + 1) // avance optimista (ui-principles)
      } else if (e.key.toLowerCase() === "j") {
        e.preventDefault()
        setIndex((i) => Math.min(i + 1, queue.length)) // saltar sin contar
      } else if (e.key.toLowerCase() === "k") {
        e.preventDefault()
        setIndex((i) => Math.max(i - 1, 0))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [note, queue.length, markRead])

  if (isLoading) return null

  // Cola vacía o batch terminado → estado claro, no error (review/02).
  if (queue.length === 0 || index >= queue.length) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <p className="mb-4 text-muted-foreground">
          {queue.length === 0 ? "Nada para repasar hoy." : "Batch terminado."}
        </p>
        <button
          onClick={() => {
            setIndex(0)
            refetch()
          }}
          className="rounded border px-4 py-2 text-sm hover:bg-accent"
        >
          Cargar más
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{courseName ?? "Sin curso"}</span>
        <span>
          {index + 1} / {queue.length}
        </span>
      </div>
      <h1 className="mb-4 text-3xl font-bold">{note.title || "(sin título)"}</h1>
      <Editor content={note.content} editable={false} />
      <p className="mt-8 text-center text-xs text-muted-foreground">
        <kbd>Space</kbd> leído + siguiente · <kbd>J</kbd> saltar · <kbd>K</kbd> volver
      </p>
    </div>
  )
}
