import { useCallback, useEffect, useMemo, useState } from "react"
import { LayoutGrid, List, Pause, Plus, Target } from "lucide-react"
import { Button } from "@/core/ui/button"
import { ViewPill } from "@/core/components/view-pill"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/core/ui/empty"
import { HabitTileActions } from "@/habits/habit-tile-actions"
import {
  HabitTileInfo,
  HabitTileValue,
  quickLabel,
  tileTone,
  type Run,
} from "@/habits/habit-tile-info"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { todayKey } from "@/core/lib/day"
import { HabitsSkeleton } from "@/core/components/skeletons"
import { forceLoading, saveSample } from "@/core/lib/sample"
import { cn } from "@/core/lib/utils"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import { deriveHabit, meets, type HabitState } from "@/habits/habits"
import { useHabitLog, useHabits, useSetDay } from "@/habits/habits.api"
import { HabitsDialog } from "@/habits/habits-dialog"
import { formatClock } from "@/habits/habit-timer"
import { useHabitTimer } from "@/habits/use-habit-timer"
import { HabitZoom } from "@/habits/habit-zoom"
import { HabitFold } from "@/habits/habit-fold"
import { HabitListRow } from "@/habits/habit-list"
import { LINGER, useHabitLinger } from "@/habits/use-habit-linger"
import type { Habit } from "@/core/types/database"

// La tira de hábitos de la pantalla Hoy. Sin pantalla nueva (ui-principles): vive entre el card de
// repaso y la lista de Notebooks, que es donde el usuario ya entra 2–3 veces por día.

type Entry = { h: Habit; state: HabitState }

export function HabitTiles() {
  const { data: habits = [] } = useHabits()
  const { data: log = [], isSuccess: logReady } = useHabitLog()
  const setDay = useSetDay()
  const [open, setOpen] = useState<"list" | "new" | null>(null)
  // Sin persistir, igual que el toggle de Notebooks.
  const [view, setView] = useState<"tarjetas" | "lista">("tarjetas")

  const entries = useMemo(
    () => habits.map((h): Entry => ({ h, state: deriveHabit(h, log) })),
    [habits, log],
  )

  const { runningId, shown, clock, toggle } = useHabitTimer(habits, log)
  const { lingering, leaving, arrived } = useHabitLinger(entries)

  // La acción rápida del cuerpo del tile, que es la misma que dispara el chord h>N.
  const quick = useCallback(
    (e: Entry) => {
      if (e.h.metric === "time") return toggle(e.h)
      const today = e.state.today
      // check = toggle (set absoluto 0/1); count = +1 relativo: el onMutate lo aplica sobre el
      // cache más fresco, así dos taps rápidos antes del repaint suman 2 aunque `today` (de la
      // render) esté viejo. Un solo mecanismo de escritura, no dos.
      if (e.h.metric === "check") {
        setDay.mutate({ habit: e.h, day: todayKey(), value: today ? 0 : 1 })
      } else {
        setDay.mutate({ habit: e.h, day: todayKey(), delta: 1 })
      }
    },
    [toggle, setDay],
  )

  useEffect(() => {
    if (logReady) saveSample({ habits: entries.length })
  }, [logReady, entries.length])

  // Sin el log no se dibuja nada. El +1 y el toggle se calculan sobre lo de hoy y el target
  // congelado sale de ese mismo cache: con el log a medio cargar, un click escribiría `amount: 1`
  // sobre la fila real del día y le pisaría el target. Mostrar 0/3 mientras carga tampoco sirve.
  if (!logReady || forceLoading()) return <HabitsSkeleton />

  const met = entries.filter((e) => e.state.met).length
  // Pendientes primero en las dos vistas: lo que falta queda en las 2 filas visibles del plegado.
  // toSorted es estable → dentro de cada grupo sigue created_at. Los atajos h>N NO siguen este
  // orden (van por created_at, abajo): el dígito de un hábito no cambia cuando lo cumplís.
  // Recién cumplido = todavía pendiente para el orden mientras dura su linger.
  const done = (e: Entry) => e.state.met && !lingering.has(e.h.id)
  const sorted = entries.toSorted((a, b) => Number(done(a)) - Number(done(b)))
  const props = (e: Entry) => ({
    e,
    total: runningId === e.h.id ? shown : e.state.total,
    running: runningId === e.h.id,
    clock: runningId === e.h.id ? clock : null,
    pending: setDay.isPending,
    onQuick: () => quick(e),
    lingering: lingering.has(e.h.id),
    leaving: leaving === e.h.id,
  })

  return (
    <div className="mb-8">
      {/* Misma cabecera que Notebooks — mismo `text-xl` + contador `mono-dim`. Antes la tira aparecía
          sin nombre entre el card de repaso y Notebooks, y la única acción era un botón primario que
          pesaba más que los hábitos: crear más competía con lo que ya tenías. */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Hábitos</h2>
          {/* `met` es por PERÍODO, no por día (ADR 0009): un `3 por semana` cuenta como cumplido
              con la semana hecha. De ahí "cumplidos" y no "hoy". */}
          {entries.length > 0 && (
            <span className="mono-dim">
              {met}/{entries.length} cumplidos
            </span>
          )}
        </div>

        {entries.length > 0 && (
          <button
            type="button"
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setOpen("list")}
          >
            ver todos
          </button>
        )}
        {entries.length > 0 && (
          <ViewPill
            value={view}
            onChange={setView}
            options={{ tarjetas: <LayoutGrid />, lista: <List /> }}
          />
        )}
        <Button
          variant="secondary"
          onClick={() => setOpen("new")}
          aria-label="Nuevo hábito"
          className={cn(entries.length === 0 && "ml-auto", "max-md:size-8 max-md:p-0")}
        >
          <Plus />
          <span className="max-md:hidden">Nuevo</span>
        </Button>
      </div>

      {/* Tarjetas: grid auto-fill 310px (3 por fila en desktop), plegado a 2 filas. Lista: el tile
          comprimido a una fila, 2 columnas — 8 hábitos entran sin plegar. */}
      {entries.length === 0 ? (
        <Empty className="hatch rounded-xl bg-card py-10 shadow-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Target />
            </EmptyMedia>
            <EmptyTitle>Sin hábitos.</EmptyTitle>
            <EmptyDescription>Creá uno con Nuevo.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : view === "lista" ? (
        <div className="grid gap-2 md:grid-cols-2">
          {sorted.map((e) => (
            <HabitListRow key={e.h.id} {...props(e)} />
          ))}
        </div>
      ) : (
        <HabitFold
          items={sorted}
          grid="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-3"
          arrived={arrived}
          render={(e, hidden) => <HabitTile key={e.h.id} {...props(e)} hidden={hidden} />}
        />
      )}

      {/* El dígito no se dibuja: mismo trato que g>1..9, que monta hotkeys invisibles y vive en el
          cheatsheet. La numeración es el orden de la tira (created_at), que nada reordena. */}
      {entries.slice(0, 9).map((e, i) => (
        <HabitHotkey key={e.h.id} n={i + 1} onHit={() => quick(e)} />
      ))}

      {/* Se monta abierto y se desmonta al cerrar, igual que NotebookForm: así el `+` entra derecho
          al form y "ver todos" a la lista, sin que el estado del anterior sobreviva. */}
      {open && <HabitsDialog startNew={open === "new"} onClose={() => setOpen(null)} />}
    </div>
  )
}

function HabitTile({
  e: { h, state },
  total,
  running,
  clock,
  pending,
  onQuick,
  lingering,
  leaving,
  hidden,
}: {
  e: Entry
  total: number
  running: boolean
  clock: string | null
  pending: boolean
  onQuick: () => void
  lingering: boolean
  leaving: boolean
  hidden: boolean
}) {
  const met = meets(h.kind, total, h.target)
  const tone = tileTone(h, total, met)
  const pct = Math.min(100, (total / Math.max(h.target, 1)) * 100)
  // Cumplido = bloque lleno; pasado = sin relleno (solo el número en rojo).
  const block = tone === "over" ? 0 : tone === "done" ? 100 : pct
  const paused = h.metric === "time" && !running && total > 0 && !met
  // Pausado = el mismo reloj, congelado en lo guardado (total viene en segundos).
  const r: Run = { running, clock: clock ?? (paused ? formatClock(total) : null), paused }
  // Check cumplido ya no es "activo": el hero lleva la marca y el botón pasa a deshacer.
  const isActive = running
  const [zoom, setZoom] = useState(false)
  // Estable: HabitZoom lo tiene de dep y el tile repinta cada segundo con el timer.
  const closeZoom = useCallback(() => setZoom(false), [])

  return (
    // Bloque que sube sobre hatch (spec, ADR 0023): vacío = hatch, progreso = bloque a pct.
    <div
      // Nombre de view-transition = se desliza cuando cambia el orden. Sin nombre: el que sale
      // (hace su propio fade) y el plegado (el snapshot ignora el overflow del fold y flotaría).
      style={leaving || hidden ? undefined : { viewTransitionName: `habit-${h.id}` }}
      className={cn(
        "group hatch relative flex min-h-35 flex-col justify-between gap-3 overflow-hidden rounded-xl bg-card p-4 shadow-card [view-transition-class:habit]",
        leaving && "animate-out fill-mode-forwards fade-out zoom-out-95 duration-200 ease-out",
      )}
    >
      <span
        aria-hidden
        style={{ height: `${block}%` }}
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-xl bg-habit-block transition-[height] duration-300",
          paused && "opacity-60",
        )}
      />
      {/* Linger: barrido verde de abajo arriba + barra que se vacía hasta que el tile se va. */}
      {lingering && (
        <>
          <span aria-hidden className="habit-sweep absolute inset-0 rounded-xl bg-signal/10" />
          <span
            aria-hidden
            className="absolute inset-x-4 bottom-2 h-0.5 overflow-hidden rounded-full bg-signal/15"
          >
            <span
              className="habit-drain block h-full bg-signal"
              style={{ animationDuration: `${LINGER}ms` }}
            />
          </span>
        </>
      )}

      <div className="relative flex items-center gap-3">
        {/* Toda la fila es UNA zona de click (stretched button): ícono y nombre quedan debajo y el
            hit target es el ancho entero. Mouse-only — teclado y lector usan el botón de la derecha,
            que ya hace lo mismo; sin esto eran 3 tab stops con el mismo label. El panel (z encima)
            sigue abriendo lo suyo. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={onQuick}
          className="absolute -inset-1.5 cursor-pointer rounded-lg"
        />
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-fg-secondary transition-colors",
            running && "text-signal",
          )}
        >
          {running ? (
            <Pause size={16} fill="currentColor" strokeWidth={0} />
          ) : (
            <NotebookIcon icon={h.icon} fallback={Target} className="size-5" />
          )}
        </span>

        <HabitTileInfo h={h} total={total} r={r} tone={tone} />

        <HabitTileActions
          h={h}
          state={state}
          total={total}
          running={running}
          isActive={isActive}
          pending={pending}
          quickLabel={quickLabel(h, r)}
          onQuick={onQuick}
          onZoom={() => setZoom(true)}
        />
      </div>

      <div className="relative flex flex-col gap-3">
        <HabitTileValue
          h={h}
          state={state}
          total={total}
          r={r}
          tone={tone}
          onHero={onQuick}
          celebrate={lingering}
        />
      </div>

      {zoom && (
        <HabitZoom h={h} total={total} r={r} block={block} onQuick={onQuick} onClose={closeZoom} />
      )}
    </div>
  )
}

// Un componente = un hook por dígito, no un solo useHotkeys con los 9: la lib comparte el buffer
// de secuencia entre los atajos de una misma llamada, así que "h>1","h>2",… se pisarían y sólo
// dispararía el primero (mismo motivo que NotebookHotkey en app.tsx).
function HabitHotkey({ n, onHit }: { n: number; onHit: () => void }) {
  useSafeHotkeys(`h>${n}`, onHit, { sequenceTimeoutMs: 900, preventDefault: true }, [onHit])
  return null
}
