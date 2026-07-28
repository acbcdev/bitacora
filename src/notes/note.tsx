import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Maximize2, Trash2 } from "lucide-react"
import { ConfirmDelete } from "@/components/confirm-delete"
import { Editor } from "@/components/editor"
import { NoteSkeleton } from "@/components/skeletons"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useCourses } from "@/lib/courses"
import { useDeleteNote, useNoteDraft } from "@/lib/notes"
import { dayOf, useReadStats } from "@/lib/stats"

// Pantalla Nota (screen 3): editor Tiptap a página completa. Autosave debounced, sin botón guardar.
// F entra/sale de focus mode: se va todo el chrome (el sidebar lo esconde App) y la nota crece.
export function Note({ focus, setFocus }: { focus: boolean; setFocus: (v: boolean) => void }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { note, isLoading, title, savedAt, onTitleChange, onDocChange, save, exportMd } =
    useNoteDraft(id)
  const { data: courses = [] } = useCourses()
  const { data: stats } = useReadStats()
  const del = useDeleteNote()
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el?.closest?.("input, textarea, select, [contenteditable=true]")) return
      if (e.key.toLowerCase() === "f") {
        e.preventDefault()
        setFocus(!focus)
      } else if (e.key === "Escape" && focus) {
        setFocus(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [focus, setFocus])

  if (isLoading) return <NoteSkeleton />
  if (!note) return <p className="p-8 text-muted-foreground">Nota no encontrada.</p>

  const course = courses.find((c) => c.id === note.course_id)
  const reads = stats?.byNote.get(note.id)
  const count = reads?.count ?? 0

  return (
    <div className={`fade-in mx-auto max-w-read px-8 ${focus ? "py-16" : "pt-9 pb-16"}`}>
      {focus ? (
        <div className="fixed top-4 right-5 z-10">
          <Button variant="ghost" size="sm" onClick={() => setFocus(false)}>
            Salir de focus <Kbd>esc</Kbd>
          </Button>
        </div>
      ) : (
        <div className="mb-8 flex items-center gap-2.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigate(note.course_id ? `/course/${note.course_id}` : "/courses")}
                aria-label="Volver"
              >
                <ArrowLeft className="size-[15px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Volver</TooltipContent>
          </Tooltip>
          <span className="eyebrow truncate">{course?.name ?? "Sin curso"}</span>
          <span className="mono-dim hidden whitespace-nowrap sm:inline">
            · {count} {count === 1 ? "repaso" : "repasos"} · últ. {dayOf(reads?.last)}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {savedAt && <span className="mono-dim">Guardado {savedAt}</span>}
            <Button variant="ghost" size="sm" onClick={() => setFocus(true)}>
              <Maximize2 />
              Focus
            </Button>
            <Button variant="outline" size="sm" onClick={exportMd}>
              Export .md
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:text-destructive"
                  aria-label="Borrar nota"
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Borrar nota</TooltipContent>
            </Tooltip>
            <ConfirmDelete
              open={confirming}
              onOpenChange={setConfirming}
              what={title || "(sin título)"}
              onConfirm={() => id && del.mutate(id, { onSuccess: () => navigate("/courses") })}
            />
          </div>
        </div>
      )}

      {/* ponytail: textarea + field-sizing:content para que el título wrapee y crezca solo.
          Un <input> no wrapea y los títulos largos se cortaban. Sin JS de auto-resize. */}
      <textarea
        rows={1}
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={save}
        placeholder="Título"
        className="mb-6 field-sizing-content w-full resize-none bg-transparent text-4xl font-semibold tracking-tighter text-pretty outline-none placeholder:text-muted-foreground"
      />
      <div data-size={focus ? "lg" : undefined}>
        <Editor content={note.content} onChange={onDocChange} />
      </div>

      {!focus && (
        <p className="mt-10 text-center text-xs text-muted-foreground">
          <Kbd>F</Kbd> focus mode · autosave activado
        </p>
      )}
    </div>
  )
}
