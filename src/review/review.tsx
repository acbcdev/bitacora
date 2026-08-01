import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { Flame, Pencil, Trash2 } from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { Editor } from "@/core/components/editor"
import { NoteSkeleton } from "@/core/components/skeletons"
import { Button } from "@/core/ui/button"
import { Card } from "@/core/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { Kbd } from "@/core/ui/kbd"
import { Progress } from "@/core/ui/progress"
import { CourseIcon } from "@/courses/course-icon"
import { useCourses } from "@/courses/courses.api"
import { useDeleteNote } from "@/notes/notes.api"
import { useReviewQueue, useMarkRead } from "@/review/review.api"
import { docToPlainText } from "@/core/lib/tiptap-markdown"
import { DAILY_GOAL, todayKey, useReadStats } from "@/core/lib/stats"
import { Courses } from "@/courses/courses"
import type { Grade } from "@/core/types/database"

// Pantalla Hoy / Repaso (screen 1) — la que abre 2–3×/día. Keyboard-first:
//   Space = marcar leído (insert read_log) + siguiente · J = volver · K = siguiente (sin contar).
// Debajo del repaso va la lista de cursos embebida, como en el diseño.
export function Review() {
  const { data: queue = [], isLoading, refetch } = useReviewQueue()
  const { data: courses = [] } = useCourses()
  const { data: stats } = useReadStats()
  const markRead = useMarkRead()
  const delFlashcard = useDeleteNote()
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const note = queue[index]
  const course = courses.find((c) => c.id === note?.course_id)
  const readToday = stats?.today ?? 0
  const streak = stats?.streak ?? 0
  const donePct = Math.min(100, (readToday / DAILY_GOAL) * 100)

  // Cada ítem nuevo arranca sin revelar, sin el diálogo de borrado y sin la nota abierta.
  useEffect(() => {
    setRevealed(false)
    setConfirmingDelete(false)
    setDialogOpen(false)
  }, [index])

  const advance = useCallback(() => setIndex((i) => i + 1), []) // avance optimista (ui-principles)

  const markNoteRead = useCallback(() => {
    if (note) markRead.mutate({ noteId: note.id })
    advance()
  }, [note, markRead, advance])

  const gradeFlashcard = useCallback(
    (grade: Grade) => {
      if (note) markRead.mutate({ noteId: note.id, grade })
      advance()
    },
    [note, markRead, advance],
  )

  // Space: nota → leído + siguiente (igual que antes). Flashcard sin revelar → revela.
  // Flashcard ya revelada → sin acción, la autoevaluación es explícita (3 botones).
  const onSpace = useCallback(() => {
    if (note?.kind === "flashcard") {
      if (!revealed) setRevealed(true)
      return
    }
    markNoteRead()
  }, [note, revealed, markNoteRead])

  useHotkeys("space", onSpace, { preventDefault: true }, [onSpace]) // no scrollear
  useHotkeys("j", () => setIndex((i) => Math.max(i - 1, 0)), { preventDefault: true }) // volver
  useHotkeys(
    "k",
    () => setIndex((i) => Math.min(i + 1, queue.length)), // siguiente, sin contar
    { preventDefault: true },
    [queue.length],
  )

  if (isLoading)
    return (
      <div className="fade-in mx-auto max-w-shell px-8 pt-9 pb-16">
        <Card className="py-6">
          <NoteSkeleton />
        </Card>
      </div>
    )
  const done = queue.length === 0 || index >= queue.length

  return (
    <div className="fade-in mx-auto max-w-shell px-8 pt-9 pb-16">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="eyebrow">Hoy — {todayKey()}</p>
        <div className="flex items-center gap-6">
          <span className="inline-flex items-center gap-1.5">
            <Flame size={14} className="text-brand-fg" />
            <span className="mono">
              {streak} {streak === 1 ? "día" : "días"}
            </span>
          </span>
          <span className="mono">
            leídas hoy {readToday}/{DAILY_GOAL}
          </span>
        </div>
      </div>

      <Progress
        value={donePct}
        className="mb-8 h-0.5"
        aria-label={`Meta diaria de lectura: ${readToday} de ${DAILY_GOAL} notas`}
      />

      <Card className="mb-8 py-6">
        {done ? (
          // Cola vacía o batch terminado → estado claro, no error (review/02).
          <Empty className="px-8 py-16">
            <EmptyHeader>
              <EmptyTitle className="text-lg">
                {queue.length === 0 ? "Nada para repasar hoy." : "Batch terminado."}
              </EmptyTitle>
              <EmptyDescription>
                {readToday} {readToday === 1 ? "nota leída" : "notas leídas"} hoy.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => {
                  setIndex(0)
                  refetch()
                }}
              >
                Cargar más
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="mx-auto max-w-read px-8">
            {note.kind === "note" ? (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="-m-2 mb-6 block w-full cursor-pointer rounded-lg p-2 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="mb-2 flex items-center justify-between">
                  <span className="eyebrow flex items-center gap-1.5">
                    <CourseIcon icon={course?.icon ?? null} />
                    {course?.name ?? "Sin curso"}
                  </span>
                  <span className="mono-dim">
                    {index + 1} / {queue.length}
                  </span>
                </span>
                <span key={note.id} className="note-in block">
                  <span className="mb-1.5 block text-3xl font-semibold tracking-tight text-pretty">
                    {note.title || "(sin título)"}
                  </span>
                  <span className="line-clamp-3 min-h-[3lh] text-muted-foreground">
                    {docToPlainText(note.content) || <em>Nota sin contenido todavía.</em>}
                  </span>
                </span>
              </button>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <p className="eyebrow">{course?.name ?? "Sin curso"}</p>
                  <span className="mono-dim">
                    {index + 1} / {queue.length}
                  </span>
                </div>

                <div key={note.id} className="note-in">
                  <h1 className="mb-6 text-3xl font-semibold tracking-tight text-pretty">
                    {note.title || "(sin título)"}
                  </h1>
                  {!revealed ? (
                    <p className="text-muted-foreground">
                      Pensá tu respuesta y revelala cuando estés listo.
                    </p>
                  ) : (
                    <Editor content={note.content} editable={false} />
                  )}
                </div>
              </>
            )}

            <div className="mt-8 flex items-center justify-between border-t pt-5">
              <div className="flex flex-wrap items-center gap-3.5 text-xs text-muted-foreground">
                {note.kind === "flashcard" && revealed ? (
                  <span>Elegí correcto / parcial / incorrecto abajo</span>
                ) : (
                  <span>
                    <Kbd>Space</Kbd>{" "}
                    {note.kind === "flashcard" ? "revelar respuesta" : "leído + siguiente"}
                  </span>
                )}
                <span>
                  <Kbd>J</Kbd> volver
                </span>
                <span>
                  <Kbd>K</Kbd> siguiente
                </span>
              </div>
              <div className="flex gap-2">
                {note.kind === "flashcard" ? (
                  revealed ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hover:text-destructive"
                        aria-label="Borrar flashcard"
                        onClick={() => setConfirmingDelete(true)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                      <ConfirmDelete
                        open={confirmingDelete}
                        onOpenChange={setConfirmingDelete}
                        what={note.title || "(sin título)"}
                        onConfirm={() => delFlashcard.mutate(note.id, { onSuccess: advance })}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => gradeFlashcard("incorrecto")}
                      >
                        Incorrecto
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => gradeFlashcard("parcial")}>
                        Parcial
                      </Button>
                      <Button size="sm" onClick={() => gradeFlashcard("correcto")}>
                        Correcto
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setRevealed(true)}>
                      Revelar respuesta
                    </Button>
                  )
                ) : (
                  <Button size="sm" onClick={markNoteRead}>
                    Marcar leído
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {note &&
        note.kind === "note" && (
          // Con showCloseButton por default (a diferencia de course-form/cheatsheet): esto es un
          // visor de solo lectura, no un form — la X es el segundo de los dos dismiss paths del spec.
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <p className="eyebrow mb-1 flex items-center gap-1.5">
                  <CourseIcon icon={course?.icon ?? null} />
                  {course?.name ?? "Sin curso"}
                </p>
                <DialogTitle className="text-xl font-semibold text-pretty">
                  {note.title || "(sin título)"}
                </DialogTitle>
              </DialogHeader>
              <Editor content={note.content} editable={false} />
              <DialogFooter>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDialogOpen(false)
                    navigate(
                      note.course_id ? `/course/${note.course_id}/${note.id}` : `/note/${note.id}`,
                    )
                  }}
                >
                  <Pencil />
                  Editar
                </Button>
                <Button size="sm" onClick={markNoteRead}>
                  Marcar leído
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

      <Courses embed />
    </div>
  )
}
