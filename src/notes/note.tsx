import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { ArrowLeft } from "lucide-react"
import { Editor } from "@/core/components/editor"
import type { EditorHandle } from "@/core/components/editor"
import { NoteSkeleton } from "@/core/components/skeletons"
import { NoteActions } from "@/notes/note-actions"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { useCourses } from "@/courses/courses.api"
import { useNoteDraft } from "@/notes/notes.api"
import { dayOf, useReadStats } from "@/core/lib/stats"

// Editor de nota: usado standalone en /note/:id (notas sin curso) y embebido en Course.tsx
// (notes/06, /course/:id/:noteId). F entra/sale de focus mode: se va todo el chrome (el
// sidebar de App y, si embedded, el aside del curso) y la nota crece. Autosave debounced.
// embedded=true: sin botón Volver ni nombre de curso (ya están en el aside del curso).
export function NoteEditor({
  id,
  focus,
  setFocus,
  embedded = false,
}: {
  id: string
  focus: boolean
  setFocus: (v: boolean) => void
  embedded?: boolean
}) {
  const navigate = useNavigate()
  const { note, isLoading, title, savedAt, onTitleChange, onDocChange, save, getDoc } =
    useNoteDraft(id)
  const { data: courses = [] } = useCourses()
  const { data: stats } = useReadStats()
  const [confirming, setConfirming] = useState(false)
  const editorRef = useRef<EditorHandle>(null)

  // Paste "smart" tipo Notion (notes/05): con el título vacío, pegar un bloque multilínea
  // -sea en el título o en el body- manda la 1ra línea al título y el resto al body.
  // Título ya tiene texto: paste normal, sin magia.
  function splitTitleFromPaste(text: string): { first: string; rest: string } | null {
    if (title.trim() !== "" || !text.includes("\n")) return null
    const [first, ...rest] = text.split("\n")
    return { first: first.trim(), rest: rest.join("\n").trim() }
  }

  function onTitlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const split = splitTitleFromPaste(e.clipboardData.getData("text/plain"))
    if (!split) return

    e.preventDefault()
    onTitleChange(split.first)
    if (split.rest) editorRef.current?.insertMarkdownAtStart(split.rest)
  }

  // Prop genérica onPaste del Editor: se llama cuando el paste cae directo en el body.
  function onPaste(text: string): string {
    const split = splitTitleFromPaste(text)
    if (!split) return text
    onTitleChange(split.first)
    return split.rest
  }

  // Cmd+V en cualquier parte de la página (nada enfocado, click en el chrome, etc), no solo
  // adentro del título o el editor: título vacío -> título/body como arriba; título con texto
  // -> todo el paste al body. El evento "paste" nativo burbujea a document igual, por eso se
  // ignora acá si ya lo agarró el textarea o el editor (tienen su propio onPaste).
  useEffect(() => {
    function onGlobalPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest("textarea, .tiptap-host")) return
      const text = e.clipboardData?.getData("text/plain")
      if (!text) return

      e.preventDefault()
      if (title.trim() !== "") {
        editorRef.current?.insertMarkdownAtStart(text)
        return
      }
      const [first, ...rest] = text.split("\n")
      onTitleChange(first.trim())
      const body = rest.join("\n").trim()
      if (body) editorRef.current?.insertMarkdownAtStart(body)
    }

    document.addEventListener("paste", onGlobalPaste)
    return () => document.removeEventListener("paste", onGlobalPaste)
  }, [title, onTitleChange])

  // Global en esta vista: por default react-hotkeys-hook ignora teclas con foco en
  // input/textarea/contentEditable (para no interferir mientras escribís). Acá se fuerza para
  // Esc y mod+, porque el foco está siempre en el título o el editor — pero `f` bare NO se
  // fuerza: escribir la letra "f" en la nota disparaba el toggle de focus por error. `f` queda
  // con el default (solo dispara con el foco afuera del editable) y `mod+f` cubre el caso de
  // adentro, mismo patrón que mod+j/mod+k en Course.
  const globalScope = { enableOnFormTags: true, enableOnContentEditable: true }
  useHotkeys("f", () => setFocus(!focus), { preventDefault: true }, [focus, setFocus])
  useHotkeys("mod+f", () => setFocus(!focus), { ...globalScope, preventDefault: true }, [
    focus,
    setFocus,
  ])
  useHotkeys("escape", () => setFocus(false), { ...globalScope, enabled: focus }, [setFocus])

  if (isLoading) return <NoteSkeleton />
  if (!note) return <p className="p-8 text-muted-foreground">Nota no encontrada.</p>

  const course = courses.find((c) => c.id === note.course_id)
  const reads = stats?.byNote.get(note.id)
  const count = reads?.count ?? 0

  return (
    <div
      className={`fade-in mx-auto flex min-h-full max-w-read flex-col px-4 sm:px-8 ${focus ? "py-16" : "pt-9 pb-16"}`}
    >
      {focus ? (
        <div className="fixed top-4 right-5 z-10">
          <Button variant="ghost" size="sm" onClick={() => setFocus(false)}>
            Salir de focus <Kbd>esc</Kbd>
          </Button>
        </div>
      ) : (
        <div className="mb-8 flex items-center gap-2.5">
          {!embedded && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      navigate(note.course_id ? `/course/${note.course_id}` : "/courses")
                    }
                    aria-label="Volver"
                  >
                    <ArrowLeft className="size-[15px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Volver</TooltipContent>
              </Tooltip>
              <span className="eyebrow truncate">{course?.name ?? "Sin curso"}</span>
            </>
          )}
          <span className="mono-dim hidden whitespace-nowrap sm:inline">
            · {count} {count === 1 ? "repaso" : "repasos"} · últ. {dayOf(reads?.last)}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {savedAt && <span className="mono-dim hidden sm:inline">Guardado {savedAt}</span>}
            <NoteActions
              note={{ ...note, title }}
              content={getDoc}
              confirming={confirming}
              onConfirmingChange={setConfirming}
              onFocus={() => setFocus(true)}
              // embedded: vuelve al curso (sin noteId) -> Course.tsx auto-selecciona la próxima
              // nota. standalone: al curso si tenía uno, si no a /courses.
              onDeleted={() => navigate(note.course_id ? `/course/${note.course_id}` : "/courses")}
            />
          </div>
        </div>
      )}

      {/* ponytail: textarea + field-sizing:content para que el título wrapee y crezca solo.
          Un <input> no wrapea y los títulos largos se cortaban. Sin JS de auto-resize.
          border-b separa título/cuerpo (se confundían visualmente). */}
      <div className="mb-6 border-b pb-4">
        <textarea
          rows={1}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onPaste={onTitlePaste}
          onBlur={save}
          placeholder="Título"
          className="field-sizing-content w-full resize-none bg-transparent text-4xl font-semibold tracking-tighter text-pretty outline-none placeholder:text-muted-foreground"
        />
      </div>
      {/* flex-1 llena el resto del viewport: el footer de shortcuts queda pegado abajo en vez
          de pegado al final del contenido. onClick: clickear la zona vacía debajo del texto
          pone el cursor al final (como Notion/Docs), no se queda "muerta". */}
      <div
        data-size={focus ? "lg" : undefined}
        className="flex-1 cursor-text"
        onClick={(e) => {
          if (e.target === e.currentTarget) editorRef.current?.focusEnd()
        }}
      >
        <Editor ref={editorRef} content={note.content} onChange={onDocChange} onPaste={onPaste} />
      </div>

      {!focus && (
        <p className="pt-10 text-center text-xs text-muted-foreground">
          <Kbd>F</Kbd> focus mode
          {embedded && (
            <>
              {" "}
              · <Kbd>J</Kbd> / <Kbd>K</Kbd> entre notas
            </>
          )}{" "}
          · autosave activado
        </p>
      )}
    </div>
  )
}

// Pantalla Nota standalone (screen 3): /note/:id, para notas sin curso (note.course_id null).
// Con curso, la ruta principal es /course/:id/:noteId (Course.tsx renderiza NoteEditor inline).
export function Note({ focus, setFocus }: { focus: boolean; setFocus: (v: boolean) => void }) {
  const { id } = useParams()
  if (!id) return null
  return <NoteEditor id={id} focus={focus} setFocus={setFocus} />
}
