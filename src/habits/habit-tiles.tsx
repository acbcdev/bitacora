import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { Check, Flame, Minus, Pause, Play, Plus, Target } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { CourseIcon } from "@/courses/course-icon"
import { todayKey } from "@/core/lib/day"
import { cn } from "@/core/lib/utils"
import { deriveHabit, goalText, meets, TRACKED_DAYS, type HabitState } from "@/habits/habits"
import { useHabitLog, useHabits, useSetDay } from "@/habits/habits.api"
import { HabitHistory, HabitPanel } from "@/habits/habit-panel"
import { HabitsDialog } from "@/habits/habits-dialog"
import {
  clearTimer,
  finishTimer,
  pausedValue,
  shownClock,
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
  time: (h, t, r) =>
    r.clock ? (
      <>
        <span
          aria-hidden
          className="size-[5px] shrink-0 animate-pulse rounded-full bg-brand-strong"
        />
        <span className="text-[13px] font-medium text-brand-fg">{r.clock}</span>
        <span className="opacity-70">/{h.target}</span>
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

// Piso de ancho del slot del dato, por métrica: un check no pasa de "hoy", un time va de "0/25 min"
// a "230/120 min". Sin el piso, el número que sube con el cronómetro hace latir la tira entera
// (es flex).
const SLOT: Record<HabitMetric, string> = {
  check: "min-w-8",
  count: "min-w-10",
  time: "min-w-16",
}

// La barra no tiene color propio: se MEZCLA — rojo lo que falta, verde lo hecho. En un `bad` la
// escala va al revés (llenarse es perder), y el rojo del techo pasado sale de la misma fórmula
// (pct = 100 → done = 0), sin caso especial.
// Va SÓLIDA. Antes esto era un relleno de fondo rebajado al 30% contra --card… en un tile que nunca
// pintaba --card: se mezclaba contra un color que no estaba abajo y quedaba casi invisible. En 3px
// no hay texto encima que proteger, así que no hay nada que rebajar.
function barColor(kind: Habit["kind"], pct: number) {
  const done = Math.round(kind === "good" ? pct : 100 - pct)
  return `color-mix(in oklab, var(--brand) ${done}%, var(--destructive))`
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
  const clock = running && timer ? shownClock(running.state.total, timer) : null
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
            clock={running?.h.id === e.h.id ? clock : null}
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
  onQuick,
}: {
  e: Entry
  total: number
  running: boolean
  clock: string | null
  onQuick: () => void
}) {
  const met = meets(h.kind, total, h.target)
  const over = h.kind === "bad" && !met
  const pct = Math.min(100, (total / Math.max(h.target, 1)) * 100)
  const r: Run = { running, clock, paused: h.metric === "time" && !running && total > 0 && !met }

  return (
    <div
      className={cn(
        "group relative flex h-16 w-50 items-center gap-3 overflow-hidden rounded-lg border bg-card px-3",
        // El tile entero se ilumina: el trigger no es el ▶, es toda la superficie.
        "transition-colors hover:bg-muted",
        // El punteado significa "todavía tenés margen". Pasado el techo el borde se cierra: ya no
        // hay margen, y dejarlo punteado con el tile lleno contradice el dato.
        h.kind === "bad" && !over && "border-dashed",
        // Cumplido NO toca el borde: la barra de abajo ya lo dice, y dos señales para el mismo
        // hecho gastan el verde. El borde sólo habla cuando hay alarma (techo pasado en un `bad`).
        over ? "border-destructive text-destructive" : "border-border",
      )}
    >
      {/* El progreso vive acá abajo y no en el fondo del tile: 3px sólidos se leen, un fondo
          rebajado no. El riel gris existe para que un 5% se entienda como "5% de algo". */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-muted">
        <span
          style={{ width: `${pct}%`, backgroundColor: barColor(h.kind, pct) }}
          className="block h-full transition-[width,background-color] duration-300"
        />
      </span>

      {/* Hover = MIRAR: los 14 días viven acá, no en el menú del `⌄`, que es para CORREGIR.
          Tooltip y no popover: no hay nada que clickear adentro, así que no hace falta foco.
          `delayDuration` propio — el provider de app.tsx está en 0 y una tarjeta de 14 cuadrados
          saltando al primer píxel de hover es ruido. */}
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onQuick}
            aria-pressed={h.metric === "check" ? total > 0 : undefined}
            aria-label={quickLabel(h, r)}
            className="group/quick flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
          >
            {/* El slot del ícono ES el botón: en reposo el ícono del hábito, en hover el ▶, y
                corriendo el ‖ — que es lo que hace el click. El ■ de antes decía "parar/descartar"
                y el click guarda. El grupo es el BOTÓN y no el tile: pasar por el `⌄` no debe
                prometer un play que ese click no dispara. */}
            <span
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-secondary transition-colors",
                "group-hover/quick:text-foreground",
                running && "bg-brand-soft text-brand-fg group-hover/quick:text-brand-fg",
                // El anillo dice que hay algo empezado sin repetir el número.
                r.paused && "ring-1 ring-input",
              )}
            >
              {running ? (
                <Pause size={16} fill="currentColor" strokeWidth={0} />
              ) : (
                <>
                  <CourseIcon
                    icon={h.icon}
                    fallback={Target}
                    className={cn(
                      "size-5 transition-opacity",
                      h.metric === "time" && "group-hover/quick:opacity-0",
                    )}
                  />
                  {h.metric === "time" && (
                    <Play
                      aria-hidden
                      size={14}
                      fill="currentColor"
                      strokeWidth={0}
                      className="absolute opacity-0 transition-opacity group-hover/quick:opacity-100"
                    />
                  )}
                </>
              )}
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
                className={cn(
                  "mono-dim flex items-center gap-1 text-xs tabular-nums transition-colors",
                  SLOT[h.metric],
                  "group-hover/quick:text-fg-secondary",
                  r.paused && "text-fg-secondary",
                )}
              >
                {LABEL[h.metric](h, total, r)}
                {/* En un `bad` de tiempo el gesto ya lo dice el slot: dos íconos, lo mismo dos veces. */}
                {h.kind === "bad" && h.metric !== "time" && (
                  <Minus size={11} className="opacity-60" />
                )}
              </span>
            </span>
          </button>
        </TooltipTrigger>

        {/* Superficie de popover, no la invertida del tooltip: adentro van 14 cuadrados de color
            que sobre un fondo casi blanco se leerían al revés. Por eso también va sin flecha. */}
        <TooltipContent
          side="top"
          sideOffset={6}
          showArrow={false}
          className="flex-col items-stretch gap-2 rounded-lg border bg-popover p-2.5 text-popover-foreground"
        >
          <span className="mono-dim text-[11px]">
            {h.name} · {goalText(h)}
          </span>
          <HabitHistory habit={h} state={state} />
        </TooltipContent>
      </Tooltip>

      <span className="flex shrink-0 items-center gap-1">
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
