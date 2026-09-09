import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, Flame, Minus, Pause, Play, Plus, Target } from "lucide-react"
import { Button } from "@/core/ui/button"
import { CourseIcon } from "@/courses/course-icon"
import { todayKey } from "@/core/lib/day"
import { cn } from "@/core/lib/utils"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import {
  cellColor,
  cellPct,
  deriveHabit,
  goalText,
  meets,
  parseDay,
  streakText,
  type HabitState,
} from "@/habits/habits"
import { useHabitLog, useHabits, useSetDay } from "@/habits/habits.api"
import { HabitPanel } from "@/habits/habit-panel"
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
import type { Habit, HabitMetric } from "@/core/types/database"

// La tira de hábitos de la pantalla Hoy. Sin pantalla nueva (ui-principles): vive entre el card de
// repaso y la lista de Cursos, que es donde el usuario ya entra 2–3 veces por día.

type Entry = { h: Habit; state: HabitState }

// "7/0" no quiere decir nada: con techo cero cualquier registro ya es pasarse, así que va el
// número solo. Con techo > 0 la fracción sí informa cuánto te pasaste.
// Para time, t y h.target vienen en segundos (0011) — se muestran en min.
const ratio = (h: Habit, t: number) => {
  if (h.metric === "time") {
    const mins = Math.floor(t / 60)
    const targetMins = Math.round(h.target / 60)
    return h.kind === "bad" && targetMins === 0 ? `${mins}` : `${mins}/${targetMins}`
  }
  return h.kind === "bad" && h.target === 0 ? `${t}` : `${t}/${h.target}`
}

// Los tres estados vivos de un `time`. "Pausado" NO es un dato nuevo: pausar ya escribe los
// minutos en habit_log y borra el cronómetro (habit-timer.ts), así que sale de lo que ya hay —
// algo hecho, nada corriendo, y todavía falta. Sin campo nuevo y sin migración.
type Run = { running: boolean; clock: string | null; paused: boolean }

// El dato del tile sale de la métrica, no del kind: un object-map, no un switch.
const LABEL: Record<HabitMetric, (h: Habit, t: number, r: Run) => ReactNode> = {
  check: (_h, t) => (t > 0 ? <Check size={14} strokeWidth={3} className="text-brand-fg" /> : "hoy"),
  count: ratio,
  // Corriendo el dato pasa a reloj: `7/20 min` cambia una vez cada 60 segundos y se lee congelado,
  // que es justo lo contrario de lo que querés ver con el cronómetro andando.
  // h.target para time viene en segundos — se muestra en min.
  time: (h, t, r) =>
    r.clock ? (
      <>
        <span
          aria-hidden
          className="size-[5px] shrink-0 animate-pulse rounded-full bg-brand-strong"
        />
        <span className="text-[13px] font-medium text-brand-fg">{r.clock}</span>
        <span className="opacity-70">/{Math.round(h.target / 60)}</span>
      </>
    ) : (
      <>
        {ratio(h, t)} min
        {/* El ‖ ámbar es lo único que separa "empezaste y frenaste" de "nunca arrancaste": el
            número solo no lo dice, porque 0/20 y 7/20 se dibujan igual. */}
        {r.paused && (
          <Pause size={8} fill="currentColor" strokeWidth={0} className="text-warning" />
        )}
      </>
    ),
}

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
      {/* Misma cabecera que Cursos — mismo `text-xl` + contador `mono-dim`. Antes la tira aparecía
          sin nombre entre el card de repaso y Cursos, y la única acción era un botón primario que
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

      {/* Se monta abierto y se desmonta al cerrar, igual que CourseForm: así el `+` entra derecho
          al form y "ver todos" a la lista, sin que el estado del anterior sobreviva. */}
      {open && <HabitsDialog startNew={open === "new"} onClose={() => setOpen(null)} />}
    </div>
  )
}

// Tres gestos, tres verbos. "Cortar" mentía: el click sobre un cronómetro corriendo GUARDA los
// minutos y pausa, no descarta nada.
const quickLabel = (h: Habit, r: Run) =>
  r.running
    ? `Pausar ${h.name}`
    : r.paused
      ? `Reanudar ${h.name}`
      : h.kind === "bad"
        ? `Registrar recaída de ${h.name}`
        : `Registrar ${h.name}`

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
  // Dots: últimos 7 días siempre visibles (variant D ganador), paleta app (brand/destructive sobre muted)
  const dots = state.days.slice(-7)

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
          <CourseIcon icon={h.icon} fallback={Target} className="size-6" />
        )}
      </button>

      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <button
          type="button"
          onClick={onQuick}
          aria-label={quickLabel(h, r)}
          aria-pressed={h.metric === "check" ? total > 0 : undefined}
          className={cn(
            "block w-fit max-w-full cursor-pointer truncate rounded-sm text-left text-[14px] font-semibold leading-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            met && h.kind === "good" && "text-brand-fg",
          )}
        >
          {h.name}
        </button>
        <span className="flex items-center gap-1.5 font-mono text-[11px] leading-none text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-1 tabular-nums",
              r.paused && "text-fg-secondary",
            )}
          >
            {LABEL[h.metric](h, total, r)}
            {h.kind === "bad" && h.metric !== "time" && <Minus size={11} className="opacity-60" />}
          </span>
          <span className="opacity-40">·</span>
          <span className="truncate">{goalText(h)}</span>
          {state.streak >= 2 && (
            <span className="inline-flex items-center gap-1 text-[10px] tabular-nums">
              <Flame size={10} />
              {streakText(h, state.streak)}
            </span>
          )}
        </span>
        {/* Dots 7d — color por pct de la celda, cero = rojo pleno (ADR 0013) */}
        <span className="flex gap-[3px] pt-0.5" aria-hidden>
          {dots.map((cell, idx) => {
            // Hoy sin resaltado; gris mientras está vacío, color en cuanto hay registro — pero
            // nunca rojo: sin registro no hay recaída que pintar todavía.
            if (idx === dots.length - 1)
              return (
                <i
                  key={idx}
                  style={{
                    backgroundColor: cell.amount > 0 ? cellColor(h.kind, cellPct(cell)) : undefined,
                  }}
                  className={cn("h-[5px] flex-1 rounded-full", cell.amount === 0 && "bg-muted")}
                />
              )
            return (
              <i
                key={idx}
                style={{ backgroundColor: cellColor(h.kind, cellPct(cell)) }}
                className="h-[5px] flex-1 rounded-full"
              />
            )
          })}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {/* Corregir días pasados sólo existe en hábitos diarios: la escritura es una fila por día,
            y repartir un total semanal/mensual en días es lo que ADR 0009 no quiere (ADR 0013). */}
        {h.period === "day" && <HabitPanel habit={h} state={state} />}
        <Button
          type="button"
          size="icon-lg"
          onClick={onQuick}
          aria-label={quickLabel(h, r)}
          aria-pressed={h.metric === "check" ? total > 0 : undefined}
          // ghost traía dark:hover:bg-muted/50 y hover:text-foreground: el hover le pisaba el
          // color brand entero. Con default sólo queda hover:bg para pisar — el color nunca cambia.
          className={cn(
            "shrink-0",
            isActive
              ? "bg-brand text-brand-foreground hover:bg-brand"
              : "bg-brand-soft text-brand-fg hover:bg-brand-soft hover:brightness-110",
            // Hint visual de guardado, NO guard duro: disabled bloquearía el tap siguiente y el
            // onMutate ya serializa los taps encolados (ui-principles 4).
            pending && "opacity-60",
          )}
        >
          {h.metric === "time" ? (
            running ? (
              <Pause className="size-3.5" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="size-3.5" fill="currentColor" strokeWidth={0} />
            )
          ) : h.metric === "count" ? (
            <Plus className="size-3.5" strokeWidth={2.2} />
          ) : total > 0 ? (
            <Check className="size-3.5" strokeWidth={3} />
          ) : (
            <span className="size-3.5 rounded-full border-2 border-current opacity-60" />
          )}
        </Button>
      </span>
    </div>
  )
}

// Un componente = un hook por dígito, no un solo useHotkeys con los 9: la lib comparte el buffer
// de secuencia entre los atajos de una misma llamada, así que "h>1","h>2",… se pisarían y sólo
// dispararía el primero (mismo motivo que CourseHotkey en app.tsx).
function HabitHotkey({ n, onHit }: { n: number; onHit: () => void }) {
  useSafeHotkeys(`h>${n}`, onHit, { sequenceTimeoutMs: 900, preventDefault: true }, [onHit])
  return null
}
