import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ReviewCardSkeleton, ReviewSkeleton } from "@/core/components/skeletons"
import { Card } from "@/core/ui/card"
import { Progress } from "@/core/ui/progress"
import { useNotebooks } from "@/notebooks/notebooks.api"
import { useDeleteNote, useNote } from "@/notes/notes.api"
import { useReviewQueue } from "@/review/review.api"
import { useReviewSession } from "@/review/review-session"
import { FlashcardCard } from "@/review/flashcard-card"
import { NoteCard } from "@/review/note-card"
import { useSnapshot } from "@/core/lib/snapshot"
import { dailyCompliance, EMPTY_READ_STATS, readGoal, readStats } from "@/core/store/derive"
import { cn } from "@/core/lib/utils"
import { forceLoading } from "@/core/lib/sample"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import { Notebooks } from "@/notebooks/notebooks"
import { ReviewEmpty } from "@/review/review-empty"
import { ReviewStats } from "@/review/review-stats"
import { ReadGoalForm } from "@/review/read-goal-form"
import { HabitTiles } from "@/habits/habit-tiles"

// Pantalla Hoy / Repaso (screen 1) — la que abre 2–3×/día. Keyboard-first:
//   Enter = abrir la nota (adentro, Enter otra vez = leído + siguiente) · ← = volver · → = siguiente.
// Desde la card de una nota NO se marca leído: ahí solo se ve el preview. Eso vive en el dialog,
// gateado a haber llegado al final (CONTEXT.md), y desde ahí sí avanza. El footer de la card es
// navegación y nada más — las mismas ←/→ como botones, que sin teclado son la única salida.
// Debajo del repaso va la tira de hábitos y después la lista de notebooks embebida, como en el diseño.
// El diálogo arrastra el editor (tiptap): se baja recién al abrir una nota.
const NoteDialog = lazy(() =>
  import("@/review/note-dialog").then((m) => ({ default: m.NoteDialog })),
)

export function Review() {
  const { isLoading } = useReviewQueue()
  const session = useReviewSession()
  const { data: notebooks = [] } = useNotebooks()
  const { data: stats = EMPTY_READ_STATS } = useSnapshot((s) => readStats(s))
  const { data: days = [] } = useSnapshot((s) => dailyCompliance(s))
  const { data: goal } = useSnapshot((s) => readGoal(s))
  const delFlashcard = useDeleteNote()
  const navigate = useNavigate()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const item = session.item
  // El snapshot trae las notas sin `content`: el documento de la que se está mirando se pide
  // aparte, y sólo de esa (más la siguiente, que prefetchea la sesión). El dialog y la flashcard
  // sólo usan la nota real, nunca el placeholder.
  const { data: full, isPlaceholderData } = useNote(item?.id, { keepPrevious: true })
  const openNote = isPlaceholderData ? undefined : full
  // La card de nota: mientras la nueva no llega, la anterior ENTERA (título, extracto, notebook,
  // posición, ←), sin skeleton (ADR 0025). Sólo si la anterior era nota: con una flashcard la
  // NoteCard pintaría pregunta y respuesta sin revelar. Sin anterior (primera carga) → skeleton.
  // `lastCard` se ajusta durante el render (patrón React "estado de renders previos"), sin effect.
  const settled =
    item?.kind === "note" && openNote
      ? { note: openNote, position: session.position, isFirst: session.index === 0 }
      : null
  const [lastCard, setLastCard] = useState(settled)
  const noteCard = item?.kind === "note" ? (settled ?? lastCard) : null
  if (
    noteCard?.note !== lastCard?.note ||
    noteCard?.position !== lastCard?.position ||
    noteCard?.isFirst !== lastCard?.isFirst
  )
    setLastCard(noteCard)
  const cardNote = noteCard?.note
  const marked = session.marked
  const notebook = notebooks.find((c) => c.id === (cardNote ?? item)?.notebook_id)
  const readToday = stats?.today ?? 0
  const streak = goal?.streak ?? 0
  const reads = session.reads
  const revealed = session.revealed
  // Dos hotkeys "enter" prendidos a la vez disparan los dos: los hotkeys de la pantalla se apagan
  // juntos cuando hay dialog/confirm de borrado abierto (ver comentario en cada uso).
  // ←/→/Enter los comparten la cola y la lista de notebooks embebida: los tiene la sección con
  // más px visibles. intersectionRect ya viene recortado por el scroll de <main>.
  const cardRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [listFocused, setListFocused] = useState(false)
  const loading = isLoading || forceLoading()
  useEffect(() => {
    const card = cardRef.current
    const list = listRef.current
    if (!card || !list) return
    const visible = new Map<Element, number>()
    // ponytail: thresholds cada 5%, en una lista muy alta el cambio salta con ~100px de retraso
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target, e.intersectionRect.height)
        setListFocused((visible.get(list) ?? 0) > (visible.get(card) ?? 0))
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    )
    io.observe(card)
    io.observe(list)
    return () => io.disconnect()
  }, [loading])
  const keysEnabled = !confirmingDelete && !dialogOpen && !listFocused

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
    if (item?.kind === "flashcard") {
      if (!revealed) session.reveal()
      return
    }
    setDialogOpen(true)
  }, [item, revealed, session])

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
    if (!item || item.kind !== "note") return
    setDialogOpen(false)
    navigate(item.notebook_id ? `/notebook/${item.notebook_id}/${item.id}` : `/note/${item.id}`)
  }, [item, navigate])

  useSafeHotkeys("mod+enter", openExpanded, { preventDefault: true, enabled: keysEnabled }, [
    openExpanded,
    keysEnabled,
  ])

  // "Focus" del menú de acciones vive en NoteActions (única superficie que lo usaba desde el
  // dialog): cruza el seam de useFocusMode con focusHref — sin props perforados por acá.

  useSafeHotkeys("left", prev, { preventDefault: true, enabled: keysEnabled }, [prev, keysEnabled]) // volver
  useSafeHotkeys("right", next, { preventDefault: true, enabled: keysEnabled }, [next, keysEnabled]) // siguiente, sin contar

  if (loading)
    return (
      <div className="fade-in mx-auto max-w-shell px-4 pt-9 pb-16 sm:px-8">
        <ReviewSkeleton />
      </div>
    )
  const done = session.done

  return (
    <div className="fade-in mx-auto max-w-shell px-4 pt-9 pb-16 sm:px-8">
      <ReviewStats streak={streak} readToday={readToday} goal={goal?.target} days={days} />

      {/* Sin meta todavía (usuario nuevo): se pide acá, donde se usa. Después vive en Ajustes. */}
      {goal ? (
        <Progress
          value={Math.min(100, (readToday / goal.target) * 100)}
          className="mb-8 h-0.5"
          aria-label={`Meta diaria de lectura: ${readToday} de ${goal.target} notas`}
        />
      ) : (
        <Card className="mb-8 flex-row items-center justify-between gap-4 px-5 py-4">
          <p className="text-sm">¿Cuántas notas querés leer por día?</p>
          <ReadGoalForm />
        </Card>
      )}

      {/* `relative`: el target de abrir es un overlay sobre la Card entera (abajo). */}
      <Card
        ref={cardRef}
        className={cn(
          // La card que importa (ADR 0023): --hero sube por luminancia en dark y por sombra en light.
          "relative mb-8 rounded-2xl py-5",
          // Vacío no es "la card que importa": baja a hatch ("lo que falta"), igual que los tiles.
          done || !item ? "hatch bg-card shadow-card" : "bg-hero shadow-hero",
        )}
      >
        {done || !item ? (
          <ReviewEmpty count={session.length} readToday={readToday} />
        ) : item.kind === "note" && !noteCard ? (
          <ReviewCardSkeleton />
        ) : (
          <div className="w-full px-5 sm:px-10">
            {item.kind === "note" ? (
              <NoteCard
                note={cardNote}
                notebook={notebook}
                position={noteCard!.position}
                onOpen={() => setDialogOpen(true)}
                onOpenExpanded={openExpanded}
                onPrev={prev}
                onNext={next}
                isFirst={noteCard!.isFirst}
              />
            ) : (
              <FlashcardCard
                item={item}
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
                onDelete={() => delFlashcard.mutate(item.id, { onSuccess: next })}
              />
            )}
          </div>
        )}
      </Card>

      {item?.kind === "note" && openNote && (
        <Suspense fallback={null}>
          <NoteDialog
            note={openNote}
            notebook={notebook}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            marked={marked}
            reads={reads}
            onMarkRead={markReadAndNext}
            onExpand={openExpanded}
            onDeleted={() => {
              setDialogOpen(false)
              next()
            }}
          />
        </Suspense>
      )}

      {/* Los hábitos van entre el repaso y Notebooks: a la vista en la pantalla que ya se abre
          2–3×/día, sin competirle el lugar a la nota. */}
      <HabitTiles />

      <div ref={listRef}>
        <Notebooks embed hotkeys={listFocused} />
      </div>
    </div>
  )
}
