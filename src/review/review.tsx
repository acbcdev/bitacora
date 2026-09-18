import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { NoteSkeleton } from "@/core/components/skeletons"
import { Card } from "@/core/ui/card"
import { Progress } from "@/core/ui/progress"
import { useNotebooks } from "@/notebooks/notebooks.api"
import { useDeleteNote, useNote } from "@/notes/notes.api"
import { useReviewQueue } from "@/review/review.api"
import { useReviewSession } from "@/review/review-session"
import { FlashcardCard } from "@/review/flashcard-card"
import { NoteCard } from "@/review/note-card"
import { useSnapshot } from "@/core/lib/snapshot"
import { DAILY_GOAL, EMPTY_READ_STATS, readStats } from "@/core/store/derive"
import { cn } from "@/core/lib/utils"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import { Notebooks } from "@/notebooks/notebooks"
import { ReviewEmpty } from "@/review/review-empty"
import { ReviewNoteDialog } from "@/review/review-note-dialog"
import { ReviewStats } from "@/review/review-stats"
import { HabitTiles } from "@/habits/habit-tiles"

// Pantalla Hoy / Repaso (screen 1) — la que abre 2–3×/día. Keyboard-first:
//   Enter = abrir la nota (adentro, Enter otra vez = leído + siguiente) · J = volver · K = siguiente.
// Desde la card de una nota NO se marca leído: ahí solo se ve el preview. Eso vive en el dialog,
// gateado a haber llegado al final (CONTEXT.md), y desde ahí sí avanza. El footer de la card es
// navegación y nada más — los mismos J/K como botones, que sin teclado son la única salida.
// Debajo del repaso va la tira de hábitos y después la lista de notebooks embebida, como en el diseño.
export function Review() {
  const { isLoading } = useReviewQueue()
  const session = useReviewSession()
  const { data: notebooks = [] } = useNotebooks()
  const { data: stats = EMPTY_READ_STATS } = useSnapshot((s) => readStats(s))
  const delFlashcard = useDeleteNote()
  const navigate = useNavigate()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const note = session.item
  // El snapshot trae las notas sin `content`: el documento de la que se está mirando se pide
  // aparte, y sólo de esa. Abrir Repaso ya no baja tres docs Tiptap para mostrar uno.
  const { data: openNote } = useNote(note?.id)
  const marked = session.marked
  const notebook = notebooks.find((c) => c.id === note?.notebook_id)
  const readToday = stats?.today ?? 0
  const streak = stats?.streak ?? 0
  const donePct = Math.min(100, (readToday / DAILY_GOAL) * 100)
  const reads = session.reads
  const revealed = session.revealed
  // Dos hotkeys "enter" prendidos a la vez disparan los dos: los hotkeys de la pantalla se apagan
  // juntos cuando hay dialog/confirm de borrado abierto (ver comentario en cada uso).
  const keysEnabled = !confirmingDelete && !dialogOpen

  // Cada ítem nuevo arranca sin el diálogo de borrado y sin la nota abierta.
  // revealed lo resetea la sesión en su effect de index.
  useEffect(() => {
    setConfirmingDelete(false)
    setDialogOpen(false)
  }, [session.index])

  // Navegar la cola. Avance optimista (ui-principles): no espera al refetch.
  const next = session.next
  const prev = session.prev
  const mark = session.mark

  // Desde el dialog leído SÍ avanza: cierra y pasa a la siguiente de una. El dialog lo cierra el
  // effect de [index]. El toast es el feedback de que la fila entró en read_log.
  const markReadAndNext = useCallback(() => {
    if (marked) return
    mark()
    next()
    toast.success(reads === 0 ? "Leído por primera vez" : `Leído · ${reads + 1} repasos`)
  }, [marked, mark, next, reads])

  // Enter con la card cerrada: nota → abre el dialog. NO marca leído: desde la card solo se ve
  // título + 3 líneas, marcar leído sin haber leído la nota es basura en read_log. Marcar leído
  // por teclado vive en el dialog, gateado a haber scrolleado hasta el final.
  // Flashcard sin revelar → revela. Flashcard revelada → sin acción, la autoevaluación es
  // explícita (3 botones).
  const onEnter = useCallback(() => {
    if (note?.kind === "flashcard") {
      if (!revealed) session.reveal()
      return
    }
    setDialogOpen(true)
  }, [note, revealed, session])

  // enabled: dos hotkeys "enter" prendidos a la vez disparan los dos. Con el dialog abierto Enter
  // es suyo (gateado a haber scrolleado hasta el final); con el ConfirmDelete de una flashcard
  // abierto es del botón enfocado —Cancelar/Borrar— vía el default del navegador.
  // useSafeHotkeys ya bloquea si el foco está en un overlay de otro contexto (Hábitos,
  // NotebookForm, IconPicker) o si hay un dialog porteado abierto.
  useSafeHotkeys("enter", onEnter, { preventDefault: true, enabled: keysEnabled }, [
    onEnter,
    keysEnabled,
  ])

  // mod+enter: vista expandida de la nota (misma acción que el botón Maximize2 del dialog),
  // sin pasar primero por el dialog chico. Solo notas — flashcard no tiene vista expandida.
  // Cuando el dialog está abierto, el hotkey vive en NoteDialog (raw useHotkeys) porque
  // useSafeHotkeys se bloquea solo con cualquier dialog abierto (incluido el propio).
  const openExpanded = useCallback(() => {
    if (!note || note.kind !== "note") return
    setDialogOpen(false)
    navigate(note.notebook_id ? `/notebook/${note.notebook_id}/${note.id}` : `/note/${note.id}`)
  }, [note, navigate])

  useSafeHotkeys("mod+enter", openExpanded, { preventDefault: true, enabled: keysEnabled }, [
    openExpanded,
    keysEnabled,
  ])

  // "Focus" del menú de acciones: misma navegación que expandir, pero entrando ya en focus mode.
  // `?focus=1` porque cambiar de ruta apaga el focus en App — el param se lo vuelve a prender.
  const openFocused = useCallback(() => {
    if (!note) return
    setDialogOpen(false)
    const to = note.notebook_id ? `/notebook/${note.notebook_id}/${note.id}` : `/note/${note.id}`
    navigate(`${to}?focus=1`)
  }, [note, navigate])

  useSafeHotkeys("j", prev, { preventDefault: true, enabled: keysEnabled }, [prev, keysEnabled]) // volver
  useSafeHotkeys("k", next, { preventDefault: true, enabled: keysEnabled }, [next, keysEnabled]) // siguiente, sin contar

  if (isLoading)
    return (
      <div className="fade-in mx-auto max-w-shell px-4 pt-9 pb-16 sm:px-8">
        <Card className="py-6">
          <NoteSkeleton />
        </Card>
      </div>
    )
  const done = session.done

  return (
    <div className="fade-in mx-auto max-w-shell px-4 pt-9 pb-16 sm:px-8">
      <ReviewStats streak={streak} readToday={readToday} byDay={stats?.byDay} />

      <Progress
        value={donePct}
        className="mb-8 h-0.5"
        aria-label={`Meta diaria de lectura: ${readToday} de ${DAILY_GOAL} notas`}
      />

      {/* `relative`: el target de abrir es un overlay sobre la Card entera (abajo). */}
      <Card
        className={cn(
          "relative mb-8 py-6",
          // Mismo hover que las cards de Notebooks (notebooks.tsx), un poco más suave: sobre 1120px de
          // superficie el --muted sólido pesa demasiado.
          note?.kind === "note" && !done && "transition-colors hover:bg-muted/55",
        )}
      >
        {done || !note ? (
          <ReviewEmpty
            count={session.length}
            readToday={readToday}
            onLoadMore={() => session.loadMore()}
          />
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
            {note.kind === "note" ? (
              <NoteCard
                item={note}
                notebook={notebook}
                openNote={openNote}
                position={session.position}
                onOpen={() => setDialogOpen(true)}
                onOpenExpanded={openExpanded}
                onPrev={prev}
                onNext={next}
                isFirst={session.index === 0}
              />
            ) : (
              <FlashcardCard
                item={note}
                notebook={notebook}
                openNote={openNote}
                position={session.position}
                revealed={revealed}
                marked={marked}
                onReveal={() => session.reveal()}
                onMark={mark}
                onPrev={prev}
                onNext={next}
                confirmingDelete={confirmingDelete}
                onConfirmingChange={setConfirmingDelete}
                onDelete={() => delFlashcard.mutate(note.id, { onSuccess: next })}
              />
            )}
          </div>
        )}
      </Card>

      {note && note.kind === "note" && openNote && (
        <ReviewNoteDialog
          openNote={openNote}
          notebook={notebook}
          dialogOpen={dialogOpen}
          setDialogOpen={setDialogOpen}
          marked={marked}
          reads={reads}
          markReadAndNext={markReadAndNext}
          openExpanded={openExpanded}
          openFocused={openFocused}
          next={next}
        />
      )}

      {/* Los hábitos van entre el repaso y Notebooks: a la vista en la pantalla que ya se abre
          2–3×/día, sin competirle el lugar a la nota. */}
      <HabitTiles />

      <Notebooks embed />
    </div>
  )
}
