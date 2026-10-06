import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { ArrowLeft } from "lucide-react"
import { NoteSkeleton } from "@/core/components/skeletons"
import { NoteActions } from "@/notes/note-actions"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { useNotebooks } from "@/notebooks/notebooks.api"
import { useNoteDraft } from "@/notes/notes.api"
import { NoteBody } from "@/notes/note-body"
import { dayOf } from "@/core/lib/day"
import { useSnapshot } from "@/core/lib/snapshot"
import { EMPTY_READ_STATS, readStats } from "@/core/store/derive"

// Editor de nota: usado standalone en /note/:id (notas sin notebook) y embebido en Notebook.tsx
// (notes/06, /notebook/:id/:noteId). F entra/sale de focus mode: se va todo el chrome (el
// sidebar de App y, si embedded, el aside del notebook) y la nota crece. Autosave debounced.
// embedded=true: sin botón Volver ni nombre de notebook (ya están en el aside del notebook).
export function NoteEditor({
  id,
  focus,
  onToggleFocus,
  embedded = false,
}: {
  id: string
  focus: boolean
  onToggleFocus: () => void
  embedded?: boolean
}) {
  const navigate = useNavigate()
  const draft = useNoteDraft(id)
  const { note, isLoading, title, savedAt, getDoc } = draft
  const { data: notebooks = [] } = useNotebooks()
  const { data: stats = EMPTY_READ_STATS } = useSnapshot((s) => readStats(s))
  const [confirming, setConfirming] = useState(false)
  // Global en esta vista: por default react-hotkeys-hook ignora teclas con foco en
  // input/textarea/contentEditable (para no interferir mientras escribís). Acá se fuerza para
  // Esc y mod+, porque el foco está siempre en el título o el editor. El `f` bare se retiró con
  // la regla v2 (ADR 0017): las letras escriben, focus mode queda en ⌘F solo.
  const globalScope = { enableOnFormTags: true, enableOnContentEditable: true }
  // Toggle (⌘F entra y sale): el esc del fullscreen/chrome y el del editor lo maneja el hook
  // y su URL — ya no hay hotkey de escape propio acá.
  useHotkeys("mod+f", onToggleFocus, { ...globalScope, preventDefault: true }, [onToggleFocus])

  if (isLoading) return <NoteSkeleton />
  if (!note) return <p className="p-8 text-muted-foreground">Nota no encontrada.</p>

  const notebook = notebooks.find((c) => c.id === note.notebook_id)
  const reads = stats?.byNote.get(note.id)
  const count = reads?.count ?? 0

  return (
    <div
      className={`fade-in mx-auto flex min-h-full max-w-read flex-col px-4 sm:px-8 ${focus ? "py-16" : "pt-9 pb-16"}`}
    >
      {focus ? null : (
        <div className="mb-8 flex items-center gap-2.5">
          {!embedded && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      navigate(note.notebook_id ? `/notebook/${note.notebook_id}` : "/notebooks")
                    }
                    aria-label="Volver"
                  >
                    <ArrowLeft className="size-[15px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Volver</TooltipContent>
              </Tooltip>
              <span className="eyebrow truncate">{notebook?.name ?? "Sin notebook"}</span>
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
              // embedded: vuelve al notebook (sin noteId) -> Notebook.tsx auto-selecciona la próxima
              // nota. standalone: al notebook si tenía uno, si no a /notebooks.
              onDeleted={() =>
                navigate(note.notebook_id ? `/notebook/${note.notebook_id}` : "/notebooks")
              }
            />
          </div>
        </div>
      )}

      <NoteBody draft={draft} large={focus} />

      {!focus && (
        <p className="pt-10 text-center text-xs text-muted-foreground">
          <Kbd>⌘F</Kbd> focus mode
          {embedded && (
            <>
              {" "}
              · <Kbd>⌘J</Kbd>/<Kbd>⌘K</Kbd> entre notas
            </>
          )}{" "}
          · autosave activado
        </p>
      )}
    </div>
  )
}

// Pantalla Nota standalone (screen 3): /note/:id, para notas sin notebook (note.notebook_id null).
// Con notebook, la ruta principal es /notebook/:id/:noteId (Notebook.tsx renderiza NoteEditor inline).
export function Note({ focus, onToggleFocus }: { focus: boolean; onToggleFocus: () => void }) {
  const { id } = useParams()
  if (!id) return null
  return <NoteEditor id={id} focus={focus} onToggleFocus={onToggleFocus} />
}
