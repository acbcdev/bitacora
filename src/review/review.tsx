import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { Flame, Maximize2, Trash2 } from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { Editor } from "@/core/components/editor"
import { NoteSkeleton } from "@/core/components/skeletons"
import { Button } from "@/core/ui/button"
import { Card } from "@/core/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/core/ui/dialog"
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
//   Enter = marcar leído (insert read_log) + siguiente · J = volver · K = siguiente (sin contar).
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
  const [readyToMark, setReadyToMark] = useState(false)
  // Callback ref, no useRef: Radix monta el contenido del dialog un tick después de que
  // `dialogOpen` pasa a true (patrón Presence) — un efecto atado a [dialogOpen] solo no vería el
  // nodo real todavía. Con state, el effect de abajo se re-dispara en cuanto el botón se monta.
  const [markReadBtn, setMarkReadBtn] = useState<HTMLButtonElement | null>(null)

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

  // Gate de "Enter marca leído" dentro del dialog: recién se arma cuando el botón "Marcar leído"
  // (al final del contenido) es visible — evita marcar leído sin haber llegado a leerlo.
  useEffect(() => {
    setReadyToMark(false)
    if (!dialogOpen || !markReadBtn) return
    const observer = new IntersectionObserver(([entry]) => setReadyToMark(entry.isIntersecting))
    observer.observe(markReadBtn)
    return () => observer.disconnect()
  }, [dialogOpen, note?.id, markReadBtn])

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

  // Enter: nota → leído + siguiente. Con el dialog abierto, gateado a que el botón "Marcar leído"
  // ya sea visible (si no, no hiciste nada todavía). Card cerrada: sin gate, el contenido corto ya
  // está completo a la vista. Flashcard sin revelar → revela. Flashcard revelada → sin acción, la
  // autoevaluación es explícita (3 botones).
  const onEnter = useCallback(() => {
    if (note?.kind === "flashcard") {
      if (!revealed) setRevealed(true)
      return
    }
    if (dialogOpen && !readyToMark) return
    markNoteRead()
  }, [note, revealed, dialogOpen, readyToMark, markNoteRead])

  // enabled: evita que el mismo Enter dispare en paralelo con el ConfirmDelete de una flashcard
  // (Enter sobre un botón enfocado —Cancelar/Borrar— ya lo activa el default del navegador).
  useHotkeys("enter", onEnter, { preventDefault: true, enabled: !confirmingDelete }, [
    onEnter,
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
          <div className="mx-auto max-w-read px-4 sm:px-8">
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
                    <span>Elegí correcto / parcial / incorrecto abajo</span>
                  ) : (
                    <span>
                      <Kbd>Enter</Kbd> revelar respuesta
                    </span>
                  ))}
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
                  <Button size="lg" onClick={markNoteRead}>
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
          // Estilo "página" (Notion-like): todo en flujo normal dentro de una columna centrada,
          // sin header/footer fijos — solo el expand flota arriba a la izquierda.
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent
              showCloseButton={false}
              className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
            >
              {/* Sin X: cerrar es Esc o click afuera. Solo el expand arriba a la izquierda. */}
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 left-2 z-10"
                aria-label="Abrir nota en foco"
                onClick={() => {
                  setDialogOpen(false)
                  navigate(
                    note.course_id ? `/course/${note.course_id}/${note.id}` : `/note/${note.id}`,
                  )
                }}
              >
                <Maximize2 className="size-3.5" />
              </Button>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-12 sm:py-10">
                <div className="mx-auto max-w-2xl">
                  <p className="eyebrow mb-4 flex items-center gap-1.5">
                    <CourseIcon icon={course?.icon ?? null} />
                    {course?.name ?? "Sin curso"}
                  </p>
                  <DialogTitle className="mb-8 text-2xl font-bold tracking-tight text-pretty sm:text-3xl">
                    {note.title || "(sin título)"}
                  </DialogTitle>
                  <Editor content={note.content} editable={false} />
                  <div className="mt-10 flex items-center justify-end border-t pt-6">
                    {/* ref: gate de Enter en onEnter — se arma cuando este botón es visible */}
                    <Button ref={setMarkReadBtn} size="lg" onClick={markNoteRead}>
                      Marcar leído
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

      <Courses embed />
    </div>
  )
}
