import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { toast } from "sonner"
import { Flame, Trash2 } from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { Editor } from "@/core/components/editor"
import { NoteSkeleton } from "@/core/components/skeletons"
import { NoteDialog } from "@/review/note-dialog"
import { Button } from "@/core/ui/button"
import { Card } from "@/core/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { Kbd, KbdGroup } from "@/core/ui/kbd"
import { Progress } from "@/core/ui/progress"
import { CourseIcon } from "@/courses/course-icon"
import { useCourses } from "@/courses/courses.api"
import { useDeleteNote } from "@/notes/notes.api"
import { useReviewQueue, useMarkRead } from "@/review/review.api"
import { docToPlainText } from "@/core/lib/tiptap-markdown"
import { DAILY_GOAL, HISTORY_DAYS, lastDays, todayKey, useReadStats } from "@/core/lib/stats"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { cn, MOD } from "@/core/lib/utils"
import { Courses } from "@/courses/courses"
import { HabitTiles } from "@/habits/habit-tiles"
import type { Grade } from "@/core/types/database"

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

// Los botones del footer viven sobre una card que YA cambia de fondo al hover —la card entera es
// el target de abrir, así que no se puede hoverear un botón sin hoverear la card—. El ghost de
// fábrica en dark hovea a muted/50: contra el fondo ya hovereado quedan a 3 puntos y el hover no
// se ve. Un escalón más arriba (--input) los despega en los dos temas.
const FOOTER_BTN = "hover:bg-input dark:hover:bg-input"

// Pantalla Hoy / Repaso (screen 1) — la que abre 2–3×/día. Keyboard-first:
//   Enter = abrir la nota (adentro, Enter otra vez = leído + siguiente) · J = volver · K = siguiente.
// Desde la card de una nota NO se marca leído: ahí solo se ve el preview. Eso vive en el dialog,
// gateado a haber llegado al final (CONTEXT.md), y desde ahí sí avanza. El footer de la card es
// navegación y nada más — los mismos J/K como botones, que sin teclado son la única salida.
// Debajo del repaso va la tira de hábitos y después la lista de cursos embebida, como en el diseño.
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
  // Calificar una flashcard no avanza: el ítem se queda y avanzás vos. Se guardan los ids ya
  // marcados (no un boolean por índice) para que volver a una ya leída no meta un segundo
  // insert en read_log.
  const [markedIds, setMarkedIds] = useState<ReadonlySet<string>>(new Set())
  const note = queue[index]
  const marked = !!note && markedIds.has(note.id)
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

  // Navegar la cola. Avance optimista (ui-principles): no espera al refetch. Una sola definición
  // para los atajos y para los botones del footer — sin teclado, J/K no existen.
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, queue.length)), [queue.length])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  const mark = useCallback(
    (grade?: Grade) => {
      if (!note || marked) return
      markRead.mutate({ noteId: note.id, grade })
      setMarkedIds((ids) => new Set(ids).add(note.id))
    },
    [note, marked, markRead],
  )

  // Repasos previos de esta nota (read_log) — el contador que muestra el dialog.
  const reads = (note && stats?.byNote.get(note.id)?.count) ?? 0

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

  // "Focus" del menú de acciones: misma navegación que expandir, pero entrando ya en focus mode.
  // `?focus=1` porque cambiar de ruta apaga el focus en App — el param se lo vuelve a prender.
  const openFocused = useCallback(() => {
    if (!note) return
    setDialogOpen(false)
    const to = note.course_id ? `/course/${note.course_id}/${note.id}` : `/note/${note.id}`
    navigate(`${to}?focus=1`)
  }, [note, navigate])

  useHotkeys("j", prev, { preventDefault: true }, [prev]) // volver
  useHotkeys("k", next, { preventDefault: true }, [next]) // siguiente, sin contar

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
          // Mismo hover que las cards de Cursos (courses.tsx), un poco más suave: sobre 1120px de
          // superficie el --muted sólido pesa demasiado.
          note?.kind === "note" && !done && "transition-colors hover:bg-muted/55",
        )}
      >
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
          // w-full: `mx-auto` en un flex item CANCELA el stretch, así que sin ancho definido esta
          // columna se dimensiona fit-content — y su min-content (el preview, que con `-m-2` pide
          // más que la card) le ganaba al ancho real. Resultado: en 393px se iba 23px afuera y el
          // `overflow-hidden` de la Card se comía el borde derecho del footer.
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
            {note.kind === "note" ? (
              <>
                {/* Abrir es toda la Card, no un rectángulo chico adentro de una card grande: un
                    overlay absoluto sobre la Card (de ahí su `relative`). Va como hermano y no
                    envolviendo el contenido porque el footer tiene botones propios — anidar
                    <button> en <button> es HTML inválido; acá el footer se pone encima con z-10.
                    ring-inset: la Card es overflow-hidden y un ring de afuera se recorta. */}
                <button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  aria-label={`Abrir ${note.title || "nota sin título"}`}
                  className="absolute inset-0 cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset focus-visible:outline-none"
                />
                <div className="mb-2 flex min-h-[2lh] items-start justify-between gap-3">
                  <p className="eyebrow flex items-center gap-1.5">
                    <CourseIcon icon={course?.icon ?? null} />
                    {course?.name ?? "Sin curso"}
                  </p>
                  <span className="mono-dim shrink-0 whitespace-nowrap">
                    {index + 1} / {queue.length}
                  </span>
                </div>
                <div key={note.id} className="note-in mb-6">
                  <h1 className="mb-1.5 line-clamp-2 min-h-[2lh] text-3xl font-semibold tracking-tight text-pretty">
                    {note.title || "(sin título)"}
                  </h1>
                  <p className="line-clamp-3 min-h-[3lh] text-muted-foreground">
                    {docToPlainText(note.content) || <em>Nota sin contenido todavía.</em>}
                  </p>
                </div>
              </>
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

            {/* `md` y no `sm`: acá se decide mobile, y ese breakpoint es 768 = MOBILE_BREAKPOINT
                (misma regla que drialog.tsx). Los atajos son solo desktop —en mobile no hay
                teclado—; los botones van en los dos, porque sin ellos mobile no tiene cómo moverse
                por la cola, con la tecla adentro para que sigan enseñando el atajo en desktop. */}
            <div className="relative z-10 mt-8 flex items-center justify-end border-t pt-5 md:justify-between">
              <div className="hidden flex-wrap items-center gap-2 text-xs text-muted-foreground md:flex">
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
                {/* Abrir y vista expandida son botones, no leyendas: son las dos acciones de la
                    pantalla y ya existían como atajos: un <span> con un <Kbd> las dejaba
                    inclickeables. Ghost como J/K — el footer entero es del mismo peso. */}
                {note.kind === "note" && (
                  <>
                    <Button
                      variant="ghost"
                      className={FOOTER_BTN}
                      onClick={() => setDialogOpen(true)}
                    >
                      <Kbd aria-hidden>Enter</Kbd>
                      Abrir
                    </Button>
                    <Button variant="ghost" className={FOOTER_BTN} onClick={openExpanded}>
                      <KbdGroup aria-hidden>
                        <Kbd>{MOD}</Kbd>+<Kbd>Enter</Kbd>
                      </KbdGroup>
                      Vista expandida
                    </Button>
                  </>
                )}
                {/* Solo la flashcard: la nota lleva la tecla adentro del propio botón, y repetir
                    el mismo glifo a 30cm de distancia es ruido. */}
                {note.kind === "flashcard" && (
                  <>
                    <span>
                      <Kbd>J</Kbd> volver
                    </span>
                    <span>
                      <Kbd>K</Kbd> siguiente
                    </span>
                  </>
                )}
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
                        onConfirm={() => delFlashcard.mutate(note.id, { onSuccess: next })}
                      />
                      <Button
                        variant="outline"
                        disabled={marked}
                        onClick={() => mark("incorrecto")}
                      >
                        Incorrecto
                      </Button>
                      <Button variant="outline" disabled={marked} onClick={() => mark("parcial")}>
                        Parcial
                      </Button>
                      <Button disabled={marked} onClick={() => mark("correcto")}>
                        Correcto
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setRevealed(true)}>Revelar respuesta</Button>
                  )
                ) : (
                  // Marcar leído NO vive acá: desde la card se ven 3 líneas y un insert en
                  // read_log sin haber leído es basura (CONTEXT.md). Vive en el dialog, gateado a
                  // haber scrolleado hasta el final. El footer de una nota es navegación y nada
                  // más — ghost, para no competirle el peso visual a la nota (ui-principles).
                  // El Kbd va adentro: el botón ES el atajo, no un duplicado suyo. Se esconde en
                  // mobile porque ahí no hay tecla J que apretar — el botón queda solo, y más alto
                  // para que sea un target táctil de verdad. aria-hidden: si no, el nombre
                  // accesible sería "J Volver" en desktop y "Volver" en mobile.
                  <>
                    <Button
                      variant="ghost"
                      className={cn(FOOTER_BTN, "max-md:h-10 max-md:px-4")}
                      disabled={index === 0}
                      onClick={prev}
                    >
                      <Kbd aria-hidden className="max-md:hidden">
                        J
                      </Kbd>
                      Volver
                    </Button>
                    <Button
                      variant="ghost"
                      className={cn(FOOTER_BTN, "max-md:h-10 max-md:px-4")}
                      onClick={next}
                    >
                      <Kbd aria-hidden className="max-md:hidden">
                        K
                      </Kbd>
                      Siguiente
                    </Button>
                  </>
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

      {/* Los hábitos van entre el repaso y Cursos: a la vista en la pantalla que ya se abre
          2–3×/día, sin competirle el lugar a la nota. */}
      <HabitTiles />

      <Courses embed />
    </div>
  )
}
