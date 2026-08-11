import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import {
  ArrowLeft,
  Check,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { CourseForm } from "@/courses/course-form"
import { CourseIcon } from "@/courses/course-icon"
import { NoteEditor } from "@/notes/note"
import { NoteSkeleton } from "@/core/components/skeletons"
import { Button } from "@/core/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { Item } from "@/core/ui/item"
import { Kbd } from "@/core/ui/kbd"
import { Progress } from "@/core/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { useCourses, useDeleteCourse, useUpdateCourse } from "@/courses/courses.api"
import { togglePinnedCourse, usePinnedCourseIds } from "@/courses/pinned-courses"
import { useGenerateFlashcards, useRetention } from "@/flashcards/flashcards.api"
import { useCreateNote, useNotes } from "@/notes/notes.api"
import { useIsMobile } from "@/core/hooks/use-mobile"
import { useReadStats } from "@/core/lib/stats"
import type { CourseStatus } from "@/core/types/database"

// `Item` solo trae hover para `<a>`; acá el nodo es un `<button>`, así que hover y selección van
// explícitos. `data-active` lo sigue poniendo el call site, igual que con `.nav-item`.
const NOTE_ITEM =
  "cursor-pointer items-start text-left text-fg-secondary hover:bg-muted data-[active=true]:bg-muted data-[active=true]:font-medium data-[active=true]:text-foreground"

const STATUS: Record<CourseStatus, string> = {
  active: "activo",
  paused: "pausado",
  done: "hecho",
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
  const deleteCourse = useDeleteCourse()
  const pinned = usePinnedCourseIds().includes(id!)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)

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

  // J/K y flechas entre notas del curso. J/left = atras, K/right = adelante. Además de la versión
  // bare (default de la lib: se desactiva sola con el foco en el editor embebido), se agrega el
  // alias mod+ forzado para cuando el foco SÍ está adentro del editor — misma acción, dos formas
  // de dispararla según dónde esté el foco.
  function step(dir: "back" | "forward") {
    const i = notes.findIndex((n) => n.id === selected?.id)
    const target = notes[dir === "forward" ? Math.min(i + 1, notes.length - 1) : Math.max(i - 1, 0)]
    if (target) select(target)
  }
  useHotkeys("j,left", () => step("back"), { preventDefault: true }, [notes, selected])
  useHotkeys("k,right", () => step("forward"), { preventDefault: true }, [notes, selected])
  useHotkeys(
    "mod+j,mod+left",
    () => step("back"),
    { enableOnContentEditable: true, preventDefault: true },
    [notes, selected],
  )
  useHotkeys(
    "mod+k,mod+right",
    () => step("forward"),
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

      {/* Desktop: solo la lista de notas scrollea — cabecera y acciones quedan fijas. Mobile: alto
          auto, scrollea `main`, así que el overflow va con `md:`. */}
      {!focus && (
        <aside className="flex shrink-0 flex-col border-b max-md:order-first md:w-68 md:min-h-0 md:overflow-hidden md:border-b-0 md:border-l">
          <div className="shrink-0 px-5 pt-6">
            {/* Fuente/estado/área como eyebrow y no como badges: en 272px tres badges bajan a dos
                filas y le compiten al nombre del curso, que es lo único que hay que leer rápido. */}
            <div className="eyebrow flex items-center gap-2">
              <CourseIcon icon={course.icon} className="size-5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {[course.source, STATUS[course.status], course.area].filter(Boolean).join(" · ")}
              </span>
              {/* Generar flashcards y cerrar el curso son de una vez por curso: acá, no compitiendo
                  con "Nueva nota" al pie. Además las flashcards no se ven en esta lista (kind
                  'flashcard', `useNotes` filtra 'note') — el resultado vive en /review. */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="-mr-1.5 shrink-0"
                        aria-label="Acciones del curso"
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Acciones</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => togglePinnedCourse(course.id)}>
                    {pinned ? <PinOff /> : <Pin />}
                    {pinned ? "Desfijar" : "Fijar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEditing(true)}>
                    <Pencil />
                    Editar curso
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={notes.length === 0 || generateFlashcards.isPending}
                    onClick={() => generateFlashcards.mutate()}
                  >
                    <Sparkles />
                    {generateFlashcards.isPending ? "Generando…" : "Generar flashcards"}
                  </DropdownMenuItem>
                  {/* Acá se cierra y se reabre el curso: el fin es cuando apretás el botón, no un
                      date picker. Reabrir limpia `finished_at` — si no, un curso activo quedaría
                      con fecha de fin. */}
                  <DropdownMenuItem
                    onSelect={() =>
                      updateCourse.mutate(
                        course.status === "done"
                          ? { id: course.id, status: "active", finished_at: null }
                          : {
                              id: course.id,
                              status: "done",
                              finished_at: new Date().toISOString(),
                            },
                      )
                    }
                  >
                    {course.status === "done" ? <RotateCcw /> : <Check />}
                    {course.status === "done" ? "Reabrir curso" : "Marcar finalizado"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                    <Trash2 />
                    Borrar curso
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <h1 className="mt-2 text-lg font-semibold tracking-tight text-pretty">{course.name}</h1>
            <div className="mt-4 mb-1.5 flex justify-between">
              <span className="mono-dim">
                {notes.length} notas
                {retentionPct !== undefined && ` · ${retentionPct}% retención`}
              </span>
              <span className="mono">{pct}%</span>
            </div>
            <Progress value={pct} className="h-0.75" aria-label={`Progreso del curso: ${pct}%`} />
          </div>

          <p className="eyebrow shrink-0 px-5 pt-5 pb-2">Notas</p>
          <div className="flex flex-col gap-0.5 px-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:pb-2">
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

          <div className="mt-auto shrink-0 border-t p-5 md:mt-0">
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() =>
                createNote.mutate(id!, { onSuccess: (newId) => navigate(`/course/${id}/${newId}`) })
              }
            >
              <Plus />
              Nueva nota
              <Kbd className="ml-auto">N</Kbd>
            </Button>
          </div>

          {/* Mismo dialog que la lista de cursos: `CourseForm` se monta abierto y se desmonta al
              cerrar, así el form arranca siempre con los valores frescos del curso. */}
          {editing && <CourseForm course={course} onClose={() => setEditing(false)} />}

          {/* Borrar deja la pantalla sin curso que mostrar, así que vuelve a la lista. */}
          <ConfirmDelete
            open={confirming}
            onOpenChange={setConfirming}
            what={course.name}
            onConfirm={() =>
              deleteCourse.mutate(course.id, { onSuccess: () => navigate("/courses") })
            }
          />
        </aside>
      )}
    </div>
  )
}
