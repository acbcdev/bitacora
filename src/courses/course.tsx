import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { ArrowLeft, Check, Plus, Sparkles } from "lucide-react"
import { CourseIcon } from "@/courses/course-icon"
import { NoteEditor } from "@/notes/note"
import { NoteSkeleton } from "@/core/components/skeletons"
import { Badge } from "@/core/ui/badge"
import { Button } from "@/core/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { Item } from "@/core/ui/item"
import { Progress } from "@/core/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { useCourses, useUpdateCourse } from "@/courses/courses.api"
import { useGenerateFlashcards, useRetention } from "@/flashcards/flashcards.api"
import { useCreateNote, useNotes } from "@/notes/notes.api"
import { useIsMobile } from "@/core/hooks/use-mobile"
import { useReadStats } from "@/core/lib/stats"
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

// Pantalla Curso: la nota a la izquierda (NoteEditor embedded, notes/06: mismo componente que
// /note/:id standalone, con focus mode/paste-smart/etc) y el índice del curso a la derecha.
// La URL manda: /course/:id/:noteId siempre apunta a una nota real (se auto-corrige si no).
// J / K se mueven entre notas sin tocar el mouse. Focus mode esconde este aside (y el
// Sidebar global, en App) igual que en la nota standalone.
export function Course({ focus, setFocus }: { focus: boolean; setFocus: (v: boolean) => void }) {
  const { id, noteId } = useParams()
  const navigate = useNavigate()
  const { data: courses = [] } = useCourses()
  const { data: notes = [], isLoading } = useNotes(id!)
  const { data: stats } = useReadStats()
  const createNote = useCreateNote()
  const updateCourse = useUpdateCourse()
  const generateFlashcards = useGenerateFlashcards(id!)
  const { data: retention } = useRetention()
  const isMobile = useIsMobile()

  const course = courses.find((c) => c.id === id)
  const selected = notes.find((n) => n.id === noteId) ?? notes[0]

  function select(target: { id: string }) {
    navigate(`/course/${id}/${target.id}`)
    // Stacked en mobile la nota queda debajo del índice: sin esto, tocar una nota no se ve.
    if (isMobile) document.getElementById("note-pane")?.scrollIntoView({ behavior: "smooth" })
  }

  // Auto-corrige la URL: sin noteId, o uno que no matchea ninguna nota del curso -> la 1ra.
  useEffect(() => {
    if (!isLoading && selected && selected.id !== noteId) {
      navigate(`/course/${id}/${selected.id}`, { replace: true })
    }
  }, [id, noteId, selected, isLoading, navigate])

  // J / K entre notas del curso.
  function step(dir: "j" | "k") {
    const i = notes.findIndex((n) => n.id === selected?.id)
    const target = notes[dir === "j" ? Math.min(i + 1, notes.length - 1) : Math.max(i - 1, 0)]
    if (target) select(target)
  }
  useHotkeys("j", () => step("j"), { preventDefault: true }, [notes, selected])
  useHotkeys("k", () => step("k"), { preventDefault: true }, [notes, selected])
  // Alias mod+ forzado (enableOnContentEditable): j/k solos se desactivan con el foco adentro del
  // editor embebido (default de la lib) — mod+ cubre ese caso, misma acción.
  useHotkeys(
    "mod+j",
    () => step("j"),
    { enableOnContentEditable: true, preventDefault: true },
    [notes, selected],
  )
  useHotkeys(
    "mod+k",
    () => step("k"),
    { enableOnContentEditable: true, preventDefault: true },
    [notes, selected],
  )
  useHotkeys(
    "n",
    () => createNote.mutate(id!, { onSuccess: (newId) => navigate(`/course/${id}/${newId}`) }),
    { preventDefault: true },
    [id, createNote],
  )

  const read = notes.filter((n) => (stats?.byNote.get(n.id)?.count ?? 0) > 0).length
  const pct = notes.length ? Math.round((read / notes.length) * 100) : 0
  const retentionPct = retention?.get(id!)

  if (!course) return <p className="p-8 text-muted-foreground">Curso no encontrado.</p>

  return (
    // Mobile: una columna — índice del curso arriba, nota abajo (a 393px la nota partida en dos
    // columnas queda de ~120px y el título rompe letra por letra). Scrollea `main`, no cada panel.
    <div className="fade-in flex flex-col md:h-full md:flex-row">
      <div id="note-pane" className="min-w-0 flex-1 md:overflow-y-auto">
        {isLoading ? (
          <NoteSkeleton />
        ) : selected ? (
          <NoteEditor
            key={selected.id}
            id={selected.id}
            focus={focus}
            setFocus={setFocus}
            embedded
          />
        ) : (
          <div className="mx-auto max-w-read px-4 pt-9 sm:px-8">
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

      {!focus && (
        <aside className="flex shrink-0 flex-col border-b max-md:order-first md:w-68 md:overflow-y-auto md:border-b-0 md:border-l">
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
                  <button onClick={() => select(n)}>
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
              onClick={() =>
                createNote.mutate(id!, { onSuccess: (newId) => navigate(`/course/${id}/${newId}`) })
              }
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
      )}
    </div>
  )
}
