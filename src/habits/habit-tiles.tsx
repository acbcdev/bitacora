import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { Check, Flame, Minus, Play, Plus, Square, Target } from "lucide-react"
import { CourseIcon } from "@/courses/course-icon"
import { todayKey } from "@/core/lib/stats"
import { cn } from "@/core/lib/utils"
import { deriveHabit, meets, TRACKED_DAYS, type HabitState } from "@/habits/habits"
import { useHabitLog, useHabits, useSetDay } from "@/habits/habits.api"
import { HabitPanel } from "@/habits/habit-panel"
import { HabitsDialog } from "@/habits/habits-dialog"
import {
  clearTimer,
  finishTimer,
  pausedValue,
  shownMinutes,
  startTimer,
  useTimer,
  type Timer,
} from "@/habits/habit-timer"
import type { Habit, HabitMetric } from "@/core/types/database"

// La tira de hábitos de la pantalla Hoy. Sin pantalla nueva (ui-principles): vive entre el card de
// repaso y la lista de Cursos, que es donde el usuario ya entra 2–3 veces por día.

const TODAY = TRACKED_DAYS - 1

type Entry = { h: Habit; state: HabitState }

// "7/0" no quiere decir nada: con techo cero cualquier registro ya es pasarse, así que va el
// número solo. Con techo > 0 la fracción sí informa cuánto te pasaste.
const ratio = (h: Habit, t: number) =>
  h.kind === "bad" && h.target === 0 ? `${t}` : `${t}/${h.target}`

// El dato del tile sale de la métrica, no del kind: un object-map, no un switch.
const LABEL: Record<HabitMetric, (h: Habit, t: number) => ReactNode> = {
  check: (_h, t) => (t > 0 ? <Check size={14} strokeWidth={3} className="text-brand-fg" /> : "hoy"),
  count: ratio,
  time: (h, t) => `${ratio(h, t)} min`,
}

// Piso de ancho del slot del dato, por métrica: un check no pasa de "hoy", un time va de "0/25 min"
// a "230/120 min". Sin el piso, el número que sube con el cronómetro hace latir la tira entera
// (es flex).
const SLOT: Record<HabitMetric, string> = {
  check: "min-w-8",
  count: "min-w-10",
  time: "min-w-16",
}

// El relleno no tiene color propio: se MEZCLA — rojo lo que falta, verde lo hecho. En un `bad` la
// escala va al revés (llenarse es perder), y el rojo del techo pasado sale de la misma fórmula
// (pct = 100 → done = 0), sin caso especial.
// ponytail: la mezcla se rebaja contra --card, no contra transparent — es lo que mantiene legible
// el texto de arriba y lo que hace que la escala se dé vuelta sola entre tema claro y oscuro.
const MIX = 30 // cuánto pesa el color contra el fondo del card
function fillColor(h: Habit, pct: number) {
  const done = Math.round(h.kind === "good" ? pct : 100 - pct)
  const scale = `color-mix(in oklab, var(--brand) ${done}%, var(--destructive))`
  return `color-mix(in oklab, ${scale} ${MIX}%, var(--card))`
}

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

  // Pausar escribe en el día de HOY: el resto del período ya está en la DB. Es el mismo useSetDay
  // que el click y el panel — el cronómetro no es un camino de escritura especial.
  const writePause = useCallback(
    (e: Entry, t: Timer) => {
      const value = pausedValue(e.state.days[TODAY].amount, t)
      if (value !== null) setDay.mutate({ habit: e.h, day: todayKey(), value })
    },
    [setDay],
  )

  const running = entries.find((e) => e.h.id === timer?.habitId)
  const shown = running && timer ? shownMinutes(running.state.total, timer) : 0
  // Termina solo únicamente si fue ESTE cronómetro el que cruzó la meta. Dos guardas:
  //  · sólo un `good` — en un `bad` el target es un TECHO, pasarlo no es "listo", y con techo 0 se
  //    apagaría antes de arrancar;
  //  · sólo si venías por debajo — dar play cuando ya llegaste al target (estás haciendo de más)
  //    corría hasta que lo cortás vos, no se auto-corta en el primer render.
  const reached =
    !!running &&
    running.h.kind === "good" &&
    running.state.total < running.h.target &&
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
      const today = e.state.days[TODAY].amount
      // check = toggle, count = +1. Los dos son el mismo upsert, no mecanismos aparte.
      const value = e.h.metric === "check" ? (today ? 0 : 1) : today + 1
      setDay.mutate({ habit: e.h, day: todayKey(), value })
    },
    [entries, timer, setDay, writePause],
  )

  // Sin el log no se dibuja nada. El +1 y el toggle se calculan sobre lo de hoy y el target
  // congelado sale de ese mismo cache: con el log a medio cargar, un click escribiría `amount: 1`
  // sobre la fila real del día y le pisaría el target. Mostrar 0/3 mientras carga tampoco sirve.
  if (!logReady) return null

  return (
    <div className="mb-8">
      {/* Tope duro de 2 filas: acá vive la nota, y en mobile entran 1–2 tiles por fila.
          ponytail: el tope es un max-height, no una medición del overflow — "ver todos" está
          siempre y abre el dialog, que muestra todos igual. */}
      <div className="flex max-h-34 flex-wrap gap-2 overflow-hidden">
        {entries.map((e) => (
          <HabitTile
            key={e.h.id}
            e={e}
            total={running?.h.id === e.h.id ? shown : e.state.total}
            running={running?.h.id === e.h.id}
            onQuick={() => quick(e)}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-end gap-3 text-xs text-muted-foreground">
        {entries.length > 0 && (
          <button type="button" className="hover:text-foreground" onClick={() => setOpen("list")}>
            ver todos
          </button>
        )}
        <button
          type="button"
          aria-label="Nuevo hábito"
          className="hover:text-foreground"
          onClick={() => setOpen("new")}
        >
          <Plus size={14} />
        </button>
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

const quickLabel = (h: Habit, running: boolean) =>
  running
    ? `Cortar ${h.name}`
    : h.kind === "bad"
      ? `Registrar recaída de ${h.name}`
      : `Registrar ${h.name}`

function HabitTile({
  e: { h, state },
  total,
  running,
  onQuick,
}: {
  e: Entry
  total: number
  running: boolean
  onQuick: () => void
}) {
  const met = meets(h.kind, total, h.target)
  const over = h.kind === "bad" && !met
  const pct = Math.min(100, (total / Math.max(h.target, 1)) * 100)

  return (
    <div
      className={cn(
        "group relative flex h-16 w-50 items-center gap-3 overflow-hidden rounded-lg border px-3",
        // El punteado significa "todavía tenés margen". Pasado el techo el borde se cierra: ya no
        // hay margen, y dejarlo punteado con el tile lleno contradice el dato.
        h.kind === "bad" && !over && "border-dashed",
        over
          ? "border-destructive text-destructive"
          : met && h.kind === "good"
            ? "border-brand/50"
            : "border-border",
      )}
    >
      {/* El relleno es un span de fondo, no un background-image: así el texto de arriba nunca
          cambia de color con el progreso. */}
      <span
        aria-hidden
        style={{ width: `${pct}%`, backgroundColor: fillColor(h, pct) }}
        className="absolute inset-y-0 left-0 transition-[width,background-color] duration-300"
      />

      <button
        type="button"
        onClick={onQuick}
        aria-pressed={h.metric === "check" ? total > 0 : undefined}
        aria-label={quickLabel(h, running)}
        className="relative flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card/60">
          <CourseIcon icon={h.icon} fallback={Target} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm font-medium",
              met && h.kind === "good" && "text-brand-fg",
            )}
          >
            {h.name}
          </span>
          {/* Todo lo que cambia vive en un slot de ancho mínimo con tabular-nums: con el cronómetro
              corriendo este número sube solo y sin ancho fijo el tile late. */}
          <span
            className={cn("mono-dim flex items-center gap-1 text-xs tabular-nums", SLOT[h.metric])}
          >
            {LABEL[h.metric](h, total)}
            {h.metric === "time" &&
              (running ? (
                <Square size={9} fill="currentColor" className="text-brand-fg" />
              ) : (
                <Play size={9} fill="currentColor" />
              ))}
            {/* En un `bad` de tiempo el gesto ya es el ▶: dos íconos dirían lo mismo dos veces. */}
            {h.kind === "bad" && h.metric !== "time" && <Minus size={11} className="opacity-60" />}
          </span>
        </span>
      </button>

      <span className="relative flex shrink-0 items-center gap-1 self-end pb-2.5">
        {/* Sólo a partir de 2: un 🔥 0 es ruido y desmoraliza. */}
        {state.streak >= 2 && (
          <span className="mono-dim inline-flex items-center gap-0.5 text-[10px]">
            <Flame size={10} />
            {state.streak}
          </span>
        )}
        <HabitPanel habit={h} state={state} />
      </span>
    </div>
  )
}

// Un componente = un hook por dígito, no un solo useHotkeys con los 9: la lib comparte el buffer
// de secuencia entre los atajos de una misma llamada, así que "h>1","h>2",… se pisarían y sólo
// dispararía el primero (mismo motivo que CourseHotkey en app.tsx).
function HabitHotkey({ n, onHit }: { n: number; onHit: () => void }) {
  useHotkeys(`h>${n}`, onHit, { sequenceTimeoutMs: 900, preventDefault: true }, [onHit])
  return null
}
