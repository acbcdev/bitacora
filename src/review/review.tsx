import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Flame } from "lucide-react"
import { NoteSkeleton } from "@/core/components/skeletons"
import { NoteDialog } from "@/review/note-dialog"
import { Button } from "@/core/ui/button"
import { Card } from "@/core/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { Progress } from "@/core/ui/progress"
import { useNotebooks } from "@/notebooks/notebooks.api"
import { useDeleteNote, useNote } from "@/notes/notes.api"
import { useReviewQueue } from "@/review/review.api"
import { useReviewSession } from "@/review/review-session"
import { FlashcardCard } from "@/review/flashcard-card"
import { NoteCard } from "@/review/note-card"
import { todayKey } from "@/core/lib/day"
import { useSnapshot } from "@/core/lib/snapshot"
import {
  DAILY_GOAL,
  EMPTY_READ_STATS,
  HISTORY_DAYS,
  lastDays,
  readStats,
} from "@/core/store/derive"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { cn } from "@/core/lib/utils"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import { Notebooks } from "@/notebooks/notebooks"
import { HabitTiles } from "@/habits/habit-tiles"

// Los últimos 14 días de lectura, a lo GitHub. Sin clicks: es un resumen, no un control.
// El color sale de la fracción leída contra la meta del día, no de un sí/no: 1 de 3 notas no es
// lo mismo que 3 de 3. Mezcla contra --muted (no transparent) para que la escala no se dé vuelta
// entre tema claro y oscuro. Piso de 25%: "leí algo" nunca se ve igual que "no leí nada".
function ReadHistory({ byDay }: { byDay?: Map<string, number> }) {
  const days = lastDays(byDay)
  return (
    <span
      role="img"
      aria-label={`Últimos ${HISTORY_DAYS} días de lectura: ${days.join(", ")}`}
      className="flex gap-1"
    >
      {days.map((n, i) => (
        <span
          key={i}
          style={
            n === 0
              ? undefined
              : {
                  backgroundColor: `color-mix(in oklab, var(--brand) ${Math.round(25 + Math.min(1, n / DAILY_GOAL) * 75)}%, var(--muted))`,
                }
          }
          className={cn(
            "h-7 w-3.5 rounded-[3px]",
            n === 0 && "bg-muted",
            i === HISTORY_DAYS - 1 && "ring-1 ring-border ring-offset-1 ring-offset-popover",
          )}
        />
      ))}
    </span>
  )
}

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
  useSafeHotkeys(
    "enter",
    onEnter,
    { preventDefault: true, enabled: !confirmingDelete && !dialogOpen },
    [onEnter, confirmingDelete, dialogOpen],
  )

  // mod+enter: vista expandida de la nota (misma acción que el botón Maximize2 del dialog),
  // sin pasar primero por el dialog chico. Solo notas — flashcard no tiene vista expandida.
  // Cuando el dialog está abierto, el hotkey vive en NoteDialog (raw useHotkeys) porque
  // useSafeHotkeys se bloquea solo con cualquier dialog abierto (incluido el propio).
  const openExpanded = useCallback(() => {
    if (!note || note.kind !== "note") return
    setDialogOpen(false)
    navigate(note.notebook_id ? `/notebook/${note.notebook_id}/${note.id}` : `/note/${note.id}`)
  }, [note, navigate])

  useSafeHotkeys(
    "mod+enter",
    openExpanded,
    { preventDefault: true, enabled: !confirmingDelete && !dialogOpen },
    [openExpanded, confirmingDelete, dialogOpen],
  )

  // "Focus" del menú de acciones: misma navegación que expandir, pero entrando ya en focus mode.
  // `?focus=1` porque cambiar de ruta apaga el focus en App — el param se lo vuelve a prender.
  const openFocused = useCallback(() => {
    if (!note) return
    setDialogOpen(false)
    const to = note.notebook_id ? `/notebook/${note.notebook_id}/${note.id}` : `/note/${note.id}`
    navigate(`${to}?focus=1`)
  }, [note, navigate])

  useSafeHotkeys("j", prev, { preventDefault: true, enabled: !confirmingDelete && !dialogOpen }, [
    prev,
    confirmingDelete,
    dialogOpen,
  ]) // volver
  useSafeHotkeys("k", next, { preventDefault: true, enabled: !confirmingDelete && !dialogOpen }, [
    next,
    confirmingDelete,
    dialogOpen,
  ]) // siguiente, sin contar

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
      <div className="mb-4 flex items-baseline justify-between">
        <p className="eyebrow">Hoy — {todayKey()}</p>
        <div className="flex items-center gap-6">
          {/* Hover = MIRAR el historial, igual que el tile de hábito. Sin `asChild`: el trigger
              de Radix ya es un botón, así que el 🔥 se enfoca con Tab sin inventar tabIndex.
              `delayDuration` propio — el provider de app.tsx está en 0 y la grilla saltando al
              primer píxel de hover es ruido. */}
          <Tooltip delayDuration={400}>
            <TooltipTrigger className="inline-flex cursor-default items-center gap-1.5 rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <Flame size={14} className="text-brand-fg" />
              <span className="mono">
                {streak} {streak === 1 ? "día" : "días"}
              </span>
            </TooltipTrigger>
            {/* Superficie de popover y sin flecha: adentro van cuadrados de color que sobre el
                fondo invertido del tooltip se leerían al revés (mismo motivo que HabitHistory). */}
            <TooltipContent
              side="bottom"
              sideOffset={6}
              showArrow={false}
              className="flex-col items-stretch gap-2 rounded-lg border bg-popover p-2.5 text-popover-foreground"
            >
              <span className="mono-dim text-[11px]">
                Últimos {HISTORY_DAYS} días · meta {DAILY_GOAL}/día
              </span>
              <ReadHistory byDay={stats?.byDay} />
            </TooltipContent>
          </Tooltip>
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
          // Cola vacía o batch terminado → estado claro, no error (review/02).
          <Empty className="px-4 py-12 sm:px-8 sm:py-16">
            <EmptyHeader>
              <EmptyTitle className="text-lg">
                {session.length === 0 ? "Nada para repasar hoy." : "Batch terminado."}
              </EmptyTitle>
              <EmptyDescription>
                {readToday} {readToday === 1 ? "nota leída" : "notas leídas"} hoy.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                // Re-tomar la cola del snapshot vivo: es el único punto donde se descongela.
                onClick={() => session.loadMore()}
              >
                Cargar más
              </Button>
            </EmptyContent>
          </Empty>
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
        <NoteDialog
          note={openNote}
          notebook={notebook}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          marked={marked}
          reads={reads}
          onMarkRead={markReadAndNext}
          onExpand={openExpanded}
          onFocus={openFocused}
          onDeleted={() => {
            setDialogOpen(false)
            next()
          }}
        />
      )}

      {/* Los hábitos van entre el repaso y Notebooks: a la vista en la pantalla que ya se abre
          2–3×/día, sin competirle el lugar a la nota. */}
      <HabitTiles />

      <Notebooks embed />
    </div>
  )
}
