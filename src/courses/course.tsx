import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { ArrowLeft, Check, Maximize2, Plus, Sparkles, Trash2 } from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { CourseIcon } from "@/courses/course-icon"
import { Editor } from "@/core/components/editor"
import { NoteSkeleton } from "@/core/components/skeletons"
import { Badge } from "@/core/ui/badge"
import { Button } from "@/core/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { Item } from "@/core/ui/item"
import { Kbd } from "@/core/ui/kbd"
import { Progress } from "@/core/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { useCourses, useUpdateCourse } from "@/courses/courses.api"
import { useGenerateFlashcards, useRetention } from "@/flashcards/flashcards.api"
import { useCreateNote, useDeleteNote, useNoteDraft, useNotes } from "@/notes/notes.api"
import { dayOf, useReadStats } from "@/core/lib/stats"
import type { CourseStatus } from "@/core/types/database"

// `Item` solo trae hover para `<a>`; acá el nodo es un `<button>`, así que hover y selección van
// explícitos. `data-active` lo sigue poniendo el call site, igual que con `.nav-item`.
const NOTE_ITEM =
  "cursor-pointer items-start text-left text-fg-secondary hover:bg-muted data-[active=true]:bg-muted data-[active=true]:font-medium data-[active=true]:text-foreground"

const STATUS: Record<CourseStatus, [string, "brand" | "warning" | "outline"]> = {
  active: ["activo", "brand"],
  paused: ["pausado", "warning"],
  done: ["hecho", "outline"],
}

// Pantalla Curso: la nota a la izquierda (editable, autosave) y el índice del curso a la derecha.
// J / K se mueven entre notas sin tocar el mouse.
export function Course() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: courses = [] } = useCourses()
  const { data: notes = [], isLoading } = useNotes(id!)
  const { data: stats } = useReadStats()
  const createNote = useCreateNote()
  const delNote = useDeleteNote()
  const updateCourse = useUpdateCourse()
  const generateFlashcards = useGenerateFlashcards(id!)
  const { data: retention } = useRetention()

  const course = courses.find((c) => c.id === id)
  const [sel, setSel] = useState<string | null>(null)
  const selected = notes.find((n) => n.id === sel) ?? notes[0]

  useEffect(() => setSel(null), [id])

  // J / K entre notas del curso.
  function step(dir: "j" | "k") {
    const i = notes.findIndex((n) => n.id === selected?.id)
    const target = notes[dir === "j" ? Math.min(i + 1, notes.length - 1) : Math.max(i - 1, 0)]
    if (target) setSel(target.id)
  }
  useHotkeys("j", () => step("j"), { preventDefault: true }, [notes, selected])
  useHotkeys("k", () => step("k"), { preventDefault: true }, [notes, selected])

  const read = notes.filter((n) => (stats?.byNote.get(n.id)?.count ?? 0) > 0).length
  const pct = notes.length ? Math.round((read / notes.length) * 100) : 0
  const retentionPct = retention?.get(id!)

  if (!course) return <p className="p-8 text-muted-foreground">Curso no encontrado.</p>

  return (
    <div className="fade-in flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <NoteSkeleton />
        ) : selected ? (
          <NotePane
            key={selected.id}
            noteId={selected.id}
            reads={stats?.byNote.get(selected.id)}
            onBack={() => navigate("/courses")}
            onExpand={() => navigate(`/note/${selected.id}`)}
            onDelete={() => delNote.mutate(selected.id, { onSuccess: () => setSel(null) })}
          />
        ) : (
          <div className="mx-auto max-w-read px-8 pt-9">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="mb-6"
                  onClick={() => navigate("/courses")}
                  aria-label="Volver"
                >
                  <ArrowLeft className="size-3.75" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Volver</TooltipContent>
            </Tooltip>
            <Empty className="px-0">
              <EmptyHeader>
                <EmptyTitle>Este curso todavía no tiene notas.</EmptyTitle>
                <EmptyDescription>Creá la primera.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>

      <aside className="flex w-68 shrink-0 flex-col overflow-y-auto border-l">
        <div className="px-5 pt-6 pb-5">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-pretty">
            <CourseIcon icon={course.icon} className="size-5 text-muted-foreground" />
            {course.name}
          </h1>
          <div className="mt-2 mb-3.5 flex items-center gap-2">
            <Badge variant={STATUS[course.status][1]}>{STATUS[course.status][0]}</Badge>
            <span className="mono-dim">{notes.length} notas</span>
            {retentionPct !== undefined && (
              <Badge variant="outline">{retentionPct}% retención</Badge>
            )}
          </div>
          {(course.source || course.area) && (
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {course.source && <Badge variant="outline">{course.source}</Badge>}
              {course.area && <Badge variant="outline">{course.area}</Badge>}
            </div>
          )}
          <div className="mb-1.5 flex justify-between">
            <span className="eyebrow">Progreso</span>
            <span className="mono">{pct}%</span>
          </div>
          <Progress value={pct} className="h-0.75" aria-label={`Progreso del curso: ${pct}%`} />
        </div>

        <p className="eyebrow px-5 pt-4 pb-2">Notas</p>
        <div className="flex flex-col gap-0.5 px-3">
          {notes.map((n) => {
            const count = stats?.byNote.get(n.id)?.count ?? 0
            return (
              <Item
                key={n.id}
                asChild
                size="xs"
                data-active={n.id === selected?.id}
                className={NOTE_ITEM}
              >
                <button onClick={() => setSel(n.id)}>
                  <span
                    className={`mt-1.75 size-1.25 shrink-0 rounded-full ${count > 0 ? "bg-brand" : "bg-input"}`}
                  />
                  {/* Sin `ItemTitle`: viene con `line-clamp-1` y los títulos largos tienen que
                      envolver, no cortarse. */}
                  <span className="flex-1">{n.title || "(sin título)"}</span>
                  <span className="mono-dim mt-0.5">{count}</span>
                </button>
              </Item>
            )
          })}
        </div>

        <div className="mt-auto flex flex-col gap-2 p-5">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => createNote.mutate(id!, { onSuccess: (newId) => setSel(newId) })}
          >
            <Plus />
            Nueva nota
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={notes.length === 0 || generateFlashcards.isPending}
            onClick={() => generateFlashcards.mutate()}
          >
            <Sparkles />
            {generateFlashcards.isPending ? "Generando…" : "Generar flashcards"}
          </Button>
          {/* Acá se cierra el curso: el fin es cuando apretás el botón, no un date picker. */}
          {course.status !== "done" && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() =>
                updateCourse.mutate({
                  id: course.id,
                  status: "done",
                  finished_at: new Date().toISOString(),
                })
              }
            >
              <Check />
              Finalizado
            </Button>
          )}
        </div>
      </aside>
    </div>
  )
}

function NotePane({
  noteId,
  reads,
  onBack,
  onExpand,
  onDelete,
}: {
  noteId: string
  reads: { count: number; last: string | null } | undefined
  onBack: () => void
  onExpand: () => void
  onDelete: () => void
}) {
  const { note, title, savedAt, onTitleChange, onDocChange, save, exportMd } = useNoteDraft(noteId)
  const [confirming, setConfirming] = useState(false)
  if (!note) return null

  const count = reads?.count ?? 0

  return (
    <div className="note-in mx-auto max-w-read px-8 pt-9 pb-16">
      <div className="mb-6 flex items-center gap-2.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Volver">
              <ArrowLeft className="size-3.75" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Volver</TooltipContent>
        </Tooltip>
        <span className="mono-dim hidden whitespace-nowrap sm:inline">
          últ. repaso {dayOf(reads?.last)} · {count} {count === 1 ? "repaso" : "repasos"}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {savedAt && <span className="mono-dim">Guardado {savedAt}</span>}
          <Button variant="ghost" size="sm" onClick={onExpand}>
            <Maximize2 />
            Página completa
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
            onConfirm={onDelete}
          />
        </div>
      </div>

      {/* ponytail: textarea + field-sizing:content — un <input> no wrapea títulos largos. */}
      <textarea
        rows={1}
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={save}
        placeholder="Título"
        className="mb-6 field-sizing-content w-full resize-none bg-transparent text-3xl font-semibold tracking-tight text-pretty outline-none placeholder:text-muted-foreground"
      />
      <Editor content={note.content} onChange={onDocChange} />

      <p className="mt-10 text-xs text-muted-foreground">
        <Kbd>J</Kbd> / <Kbd>K</Kbd> moverse entre notas · autosave activado
      </p>
    </div>
  )
}
