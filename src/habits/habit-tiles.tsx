import { useCallback, useEffect, useMemo, useState } from "react"
import { Pause, Plus, Target } from "lucide-react"
import { Button } from "@/core/ui/button"
import { HabitTileActions } from "@/habits/habit-tile-actions"
import { HabitTileInfo, quickLabel, type Run } from "@/habits/habit-tile-info"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { todayKey } from "@/core/lib/day"
import { cn } from "@/core/lib/utils"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import { cellColor, deriveHabit, meets, parseDay, type HabitState } from "@/habits/habits"
import { useHabitLog, useHabits, useSetDay } from "@/habits/habits.api"
import { HabitsDialog } from "@/habits/habits-dialog"
import {
  clearTimer,
  finishTimer,
  pausedValue,
  shownClock,
  shownSeconds,
  startTimer,
  useTimer,
  type Timer,
} from "@/habits/habit-timer"
import type { Habit } from "@/core/types/database"

// La tira de hábitos de la pantalla Hoy. Sin pantalla nueva (ui-principles): vive entre el card de
// repaso y la lista de Notebooks, que es donde el usuario ya entra 2–3 veces por día.

type Entry = { h: Habit; state: HabitState }

// SLOT ya no se usa: el dato vive en sub con dots debajo, no en un slot de ancho mínimo que late.
// Se mantiene el tabular-nums en el sub para el cronómetro.

// La barra no tiene color propio: se MEZCLA — rojo lo que falta, verde lo hecho. En un `bad` la
// escala va al revés (llenarse es perder), y el rojo del techo pasado sale de la misma fórmula
// (pct = 100 → done = 0), sin caso especial.
// Va SÓLIDA. Antes esto era un relleno de fondo rebajado al 30% contra --card… en un tile que nunca
// pintaba --card: se mezclaba contra un color que no estaba abajo y quedaba casi invisible. En 3px
// no hay texto encima que proteger, así que no hay nada que rebajar.
// pct de la celda ya viene listo; la mezcla es la misma del dot (ADR 0013).

export function HabitTiles() {
  const { data: habits = [] } = useHabits()
  const { data: log = [], isSuccess: logReady } = useHabitLog()
  const setDay = useSetDay()
  const timer = useTimer()
  const [open, setOpen] = useState<"list" | "new" | null>(null)
  const [, tick] = useState(0)

  // El interval sólo repinta: el transcurrido sale siempre de Date.now() - startedAt, nunca de
  // contar ticks — un tab en background throttlea el interval.
  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  const entries = useMemo(
    () => habits.map((h): Entry => ({ h, state: deriveHabit(h, log) })),
    [habits, log],
  )

  // Pausar escribe en el DÍA DE ATRIBUCIÓN (startedDay): todo el elapsed va al día en que el
  // timer arrancó, aunque la pausa caiga pasada la medianoche (spec habit-timer-attribution).
  // La base es la fila de startedDay — no la de hoy ni el total del período.
  const writePause = useCallback(
    (e: Entry, t: Timer) => {
      const base = log.find((r) => r.habit_id === e.h.id && r.day === t.startedDay)?.amount ?? 0
      const value = pausedValue(base, t)
      if (value !== null) setDay.mutate({ habit: e.h, day: t.startedDay, value })
    },
    [setDay, log],
  )

  const running = entries.find((e) => e.h.id === timer?.habitId)
  // El estado que importa es el del DÍA DE ATRIBUCIÓN: ahí cae la escritura y ahí corre el
  // auto-finish — el período que contiene startedDay, no el de hoy.
  const startedState = useMemo(
    () => (running && timer ? deriveHabit(running.h, log, parseDay(timer.startedDay)) : null),
    [running, timer, log],
  )
  const shown = startedState && timer ? shownSeconds(startedState.total, timer) : 0
  const clock = startedState && timer ? shownClock(startedState.total, timer) : null
  // Termina solo únicamente si fue ESTE cronómetro el que cruzó la meta. Dos guardas:
  //  · sólo un `good` — en un `bad` el target es un TECHO, pasarlo no es "listo", y con techo 0 se
  //    apagaría antes de arrancar;
  //  · sólo si venías por debajo — dar play cuando ya llegaste al target del día de inicio
  //    (estás haciendo de más) corría hasta que lo cortás vos, no se auto-corta en el primer
  //    render. La comparación es contra el período de startedDay: 23:59→00:19 corta contra el
  //    día de ayer, no contra hoy. Con segundos (0011) no hay round: se compara directo.
  const reached =
    !!running &&
    !!startedState &&
    running.h.kind === "good" &&
    startedState.total < running.h.target &&
    shown >= running.h.target

  // Llegar a la meta guarda y apaga solo. Depende únicamente de `reached` a propósito: finishTimer
  // limpia el localStorage, así que el efecto se auto-desarma en el render siguiente.
  useEffect(() => {
    if (!reached || !running || !timer) return
    writePause(running, timer)
    finishTimer(running.h.name, shown)
    // oxlint-disable-next-line exhaustive-deps
  }, [reached])

  // La acción rápida del cuerpo del tile, que es la misma que dispara el chord h>N.
  const quick = useCallback(
    (e: Entry) => {
      if (e.h.metric === "time") {
        if (timer?.habitId === e.h.id) {
          writePause(e, timer)
          return clearTimer()
        }
        // Un timer a la vez, pero arrancar otro no pierde lo que iba corriendo.
        const other = entries.find((x) => x.h.id === timer?.habitId)
        if (other && timer) writePause(other, timer)
        return startTimer(e.h.id)
      }
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
    [entries, timer, setDay, writePause],
  )

  // Sin el log no se dibuja nada. El +1 y el toggle se calculan sobre lo de hoy y el target
  // congelado sale de ese mismo cache: con el log a medio cargar, un click escribiría `amount: 1`
  // sobre la fila real del día y le pisaría el target. Mostrar 0/3 mientras carga tampoco sirve.
  if (!logReady) return null

  const met = entries.filter((e) => e.state.met).length

  return (
    <div className="mb-8">
      {/* Misma cabecera que Notebooks — mismo `text-xl` + contador `mono-dim`. Antes la tira aparecía
          sin nombre entre el card de repaso y Notebooks, y la única acción era un botón primario que
          pesaba más que los hábitos: crear más competía con lo que ya tenías. */}
      <div className="mb-3 flex items-center gap-3">
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
        <Button
          variant="outline"
          onClick={() => setOpen("new")}
          aria-label="Nuevo hábito"
          className={cn(entries.length === 0 && "ml-auto", "max-md:size-8 max-md:p-0")}
        >
          <Plus />
          <span className="max-md:hidden">Nuevo</span>
        </Button>
      </div>

      {/* Grid para no perder espacio: auto-fill 310px, 3 por fila en desktop, 1–2 en mobile.
          Dots 7d siempre visibles (variant D ganador). Sin max-height fijo: ver todos sigue
          existiendo para >6 hábitos. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-3">
        {entries.map((e) => (
          <HabitTile
            key={e.h.id}
            e={e}
            total={running?.h.id === e.h.id ? shown : e.state.total}
            running={running?.h.id === e.h.id}
            clock={running?.h.id === e.h.id ? clock : null}
            pending={setDay.isPending}
            onQuick={() => quick(e)}
          />
        ))}
      </div>

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
}: {
  e: Entry
  total: number
  running: boolean
  clock: string | null
  pending: boolean
  onQuick: () => void
}) {
  const met = meets(h.kind, total, h.target)
  const over = h.kind === "bad" && !met
  const pct = Math.min(100, (total / Math.max(h.target, 1)) * 100)
  const r: Run = { running, clock, paused: h.metric === "time" && !running && total > 0 && !met }
  const isActive = running || (h.metric === "check" && total > 0)

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card px-3.5 py-3",
        // E ghost fuerte: 0.82 → 1 + borde, sin el lavado muted de antes
        "opacity-[0.82] hover:opacity-100 hover:border-[#3a3a3a] hover:bg-[#252525] transition-[opacity,border-color,background-color] duration-200",
        h.kind === "bad" && !over && "border-dashed",
        over ? "border-destructive text-destructive" : "border-border",
      )}
    >
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-muted">
        <span
          style={{ width: `${pct}%`, backgroundColor: cellColor(h.kind, pct) }}
          className="block h-full transition-[width,background-color] duration-300"
        />
      </span>

      {/* Título E ícono disparan la acción primaria (igual que el botón brand); la línea de
          meta/frecuencia y los dots siguen sin ser clickeables. */}
      <button
        type="button"
        onClick={onQuick}
        aria-label={quickLabel(h, r)}
        aria-pressed={h.metric === "check" ? total > 0 : undefined}
        className={cn(
          "relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-fg-secondary transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          "bg-muted",
          running && "bg-brand-soft text-brand-fg",
          r.paused && "ring-1 ring-input",
        )}
      >
        {running ? (
          <Pause size={18} fill="currentColor" strokeWidth={0} />
        ) : (
          <NotebookIcon icon={h.icon} fallback={Target} className="size-6" />
        )}
      </button>

      <HabitTileInfo h={h} state={state} total={total} r={r} met={met} onQuick={onQuick} />

      <HabitTileActions
        h={h}
        state={state}
        total={total}
        running={running}
        isActive={isActive}
        pending={pending}
        quickLabel={quickLabel(h, r)}
        onQuick={onQuick}
      />
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
