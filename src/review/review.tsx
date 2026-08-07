import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { Flame, Trash2 } from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { Editor } from "@/core/components/editor"
import { NoteSkeleton } from "@/core/components/skeletons"
import { NoteDialog } from "@/review/note-dialog"
import { Button } from "@/core/ui/button"
import { Card } from "@/core/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { Kbd } from "@/core/ui/kbd"
import { Progress } from "@/core/ui/progress"
import { CourseIcon } from "@/courses/course-icon"
import { useCourses } from "@/courses/courses.api"
import { useDeleteNote } from "@/notes/notes.api"
import { useReviewQueue, useMarkRead } from "@/review/review.api"
import { docToPlainText } from "@/core/lib/tiptap-markdown"
import { DAILY_GOAL, todayKey, useReadStats } from "@/core/lib/stats"
import { MOD } from "@/core/lib/utils"
import { Courses } from "@/courses/courses"
import type { Grade } from "@/core/types/database"

// Pantalla Hoy / Repaso (screen 1) — la que abre 2–3×/día. Keyboard-first:
//   Enter = abrir la nota (adentro, Enter otra vez = marcar leído) · J = volver · K = siguiente.
// Marcar leído NUNCA avanza solo: inserta en read_log y el ítem se queda; movés vos con J/K.
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
  // Marcar leído no avanza: el ítem se queda y avanzás vos con K. `marked` evita el segundo
  // insert en read_log si volvés a apretar Enter / el botón sobre la misma nota.
  const [marked, setMarked] = useState(false)

  const note = queue[index]
  const course = courses.find((c) => c.id === note?.course_id)
  const readToday = stats?.today ?? 0
  const streak = stats?.streak ?? 0
  const donePct = Math.min(100, (readToday / DAILY_GOAL) * 100)

  // Cada ítem nuevo arranca sin revelar, sin marcar, sin el diálogo de borrado y sin la nota
  // abierta.
  useEffect(() => {
    setRevealed(false)
    setMarked(false)
    setConfirmingDelete(false)
    setDialogOpen(false)
  }, [index])

  const advance = useCallback(() => setIndex((i) => i + 1), []) // avance optimista (ui-principles)

  const markNoteRead = useCallback(() => {
    if (!note || marked) return
    markRead.mutate({ noteId: note.id })
    setMarked(true)
  }, [note, marked, markRead])

  const gradeFlashcard = useCallback(
    (grade: Grade) => {
      if (!note || marked) return
      markRead.mutate({ noteId: note.id, grade })
      setMarked(true)
    },
    [note, marked, markRead],
  )

  // Enter con la card cerrada: nota → abre el dialog. NO marca leído: desde la card solo se ve
  // título + 3 líneas, marcar leído sin haber leído la nota es basura en read_log. Marcar leído
  // por teclado vive en el dialog, gateado a haber scrolleado hasta el final.
  // Flashcard sin revelar → revela. Flashcard revelada → sin acción, la autoevaluación es
  // explícita (3 botones).
  const onEnter = useCallback(() => {
    if (note?.kind === "flashcard") {
      if (!revealed) setRevealed(true)
      return
    }
    setDialogOpen(true)
  }, [note, revealed])

  // enabled: dos hotkeys "enter" prendidos a la vez disparan los dos. Con el dialog abierto Enter
  // es suyo (gateado a haber scrolleado hasta el final); con el ConfirmDelete de una flashcard
  // abierto es del botón enfocado —Cancelar/Borrar— vía el default del navegador.
  useHotkeys(
    "enter",
    onEnter,
    { preventDefault: true, enabled: !confirmingDelete && !dialogOpen },
    [onEnter, confirmingDelete, dialogOpen],
  )

  // mod+enter: vista expandida de la nota (misma acción que el botón Maximize2 del dialog),
  // sin pasar primero por el dialog chico. Solo notas — flashcard no tiene vista expandida.
  const openExpanded = useCallback(() => {
    if (!note || note.kind !== "note") return
    setDialogOpen(false)
    navigate(note.course_id ? `/course/${note.course_id}/${note.id}` : `/note/${note.id}`)
  }, [note, navigate])

  useHotkeys("mod+enter", openExpanded, { preventDefault: true, enabled: !confirmingDelete }, [
    openExpanded,
    confirmingDelete,
  ])
  useHotkeys("j", () => setIndex((i) => Math.max(i - 1, 0)), { preventDefault: true }) // volver
  useHotkeys(
    "k",
    () => setIndex((i) => Math.min(i + 1, queue.length)), // siguiente, sin contar
    { preventDefault: true },
    [queue.length],
  )

  if (isLoading)
    return (
      <div className="fade-in mx-auto max-w-shell px-4 pt-9 pb-16 sm:px-8">
        <Card className="py-6">
          <NoteSkeleton />
        </Card>
      </div>
    )
  const done = queue.length === 0 || index >= queue.length

  return (
    <div className="fade-in mx-auto max-w-shell px-4 pt-9 pb-16 sm:px-8">
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
          <Empty className="px-4 py-12 sm:px-8 sm:py-16">
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
          <div className="mx-auto max-w-3xl px-4 sm:px-8">
            {note.kind === "note" ? (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="-m-2 mb-6 block w-full cursor-pointer rounded-lg p-2 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="mb-2 flex min-h-[2lh] items-start justify-between gap-3">
                  <span className="eyebrow flex items-center gap-1.5">
                    <CourseIcon icon={course?.icon ?? null} />
                    {course?.name ?? "Sin curso"}
                  </span>
                  <span className="mono-dim shrink-0 whitespace-nowrap">
                    {index + 1} / {queue.length}
                  </span>
                </span>
                <span key={note.id} className="note-in block">
                  <span className="mb-1.5 line-clamp-2 min-h-[2lh] text-3xl font-semibold tracking-tight text-pretty">
                    {note.title || "(sin título)"}
                  </span>
                  <span className="line-clamp-3 min-h-[3lh] text-muted-foreground">
                    {docToPlainText(note.content) || <em>Nota sin contenido todavía.</em>}
                  </span>
                </span>
              </button>
            ) : (
              <>
                <div className="mb-6 flex min-h-[2lh] items-start justify-between gap-3">
                  <p className="eyebrow">{course?.name ?? "Sin curso"}</p>
                  <span className="mono-dim shrink-0 whitespace-nowrap">
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

            <div className="mt-8 flex items-center justify-end border-t pt-5 sm:justify-between">
              {/* Los atajos no existen en mobile (no hay teclado): ahí el espacio va a los botones. */}
              <div className="hidden flex-wrap items-center gap-3.5 text-xs text-muted-foreground sm:flex">
                {note.kind === "flashcard" &&
                  (revealed ? (
                    <span>
                      {marked ? (
                        <>
                          Listo — <Kbd>K</Kbd> para la siguiente
                        </>
                      ) : (
                        "Elegí correcto / parcial / incorrecto abajo"
                      )}
                    </span>
                  ) : (
                    <span>
                      <Kbd>Enter</Kbd> revelar respuesta
                    </span>
                  ))}
                {note.kind === "note" && (
                  <>
                    <span>
                      <Kbd>Enter</Kbd> abrir
                    </span>
                    <span>
                      <Kbd>{MOD}</Kbd>+<Kbd>Enter</Kbd> vista expandida
                    </span>
                  </>
                )}
                <span>
                  <Kbd>J</Kbd> volver
                </span>
                <span>
                  <Kbd>K</Kbd> siguiente
                </span>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
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
                        disabled={marked}
                        onClick={() => gradeFlashcard("incorrecto")}
                      >
                        Incorrecto
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={marked}
                        onClick={() => gradeFlashcard("parcial")}
                      >
                        Parcial
                      </Button>
                      <Button
                        size="sm"
                        disabled={marked}
                        onClick={() => gradeFlashcard("correcto")}
                      >
                        Correcto
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setRevealed(true)}>
                      Revelar respuesta
                    </Button>
                  )
                ) : (
                  <Button size="lg" disabled={marked} onClick={markNoteRead}>
                    {marked ? "Leído" : "Marcar leído"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {note && note.kind === "note" && (
        <NoteDialog
          note={note}
          course={course}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          marked={marked}
          onMarkRead={markNoteRead}
          onExpand={openExpanded}
        />
      )}

      <Courses embed />
    </div>
  )
}
