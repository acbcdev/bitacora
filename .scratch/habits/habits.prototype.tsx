// PROTOTIPO — TIRAR. Tira de hábitos en la pantalla Hoy (`/`), entre el repaso y Cursos.
//
// La forma de la tira ya está resuelta: chips. Las descartadas —rail de segmentos, tiles, card de
// filas con los 14 días siempre visibles— vivieron acá y se borraron; el porqué quedó en `spec.md`
// (Out of Scope), que es donde sirve dentro de tres meses.
//
// La anatomía del chip también se cerró: se compararon cuatro (relleno, anillo alrededor del
// dígito, subrayado sin píldora, segmentos discretos) con un switcher `?variant=`, y ganó el
// relleno. Las otras tres y el switcher se borraron; el veredicto y el porqué están en `spec.md` y
// en `issues/03-chips-en-hoy.md`.
//
// Datos falsos en memoria: el estado ES el historial de 14 días, así se ve en vivo cómo una
// edición de hoy mueve el chip Y el tooltip.

import { type ComponentProps, useCallback, useEffect, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
  Check,
  ChevronDown,
  Flame,
  Minus,
  Play,
  Plus,
  Square,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/core/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { cn } from "@/core/lib/utils"

type Habit = {
  id: string
  name: string
  kind: "good" | "bad"
  metric: "check" | "count" | "time"
  target: number
  period: "day" | "week" | "month"
}

const HABITS: Habit[] = [
  { id: "1", name: "Meditar", kind: "good", metric: "check", target: 1, period: "day" },
  { id: "2", name: "Gym", kind: "good", metric: "count", target: 3, period: "week" },
  { id: "3", name: "Leer", kind: "good", metric: "time", target: 25, period: "day" },
  { id: "4", name: "Azúcar", kind: "bad", metric: "count", target: 0, period: "day" },
  { id: "5", name: "Redes", kind: "bad", metric: "time", target: 120, period: "week" },
]

// Últimos 14 días, índice 13 = hoy. Días parciales a propósito en "Leer": 10 sobre una meta de 25
// tiene que verse verde flojo, no rojo.
const DAYS = 14
const HISTORY: Record<string, number[]> = {
  "1": [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
  "2": [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1],
  "3": [25, 0, 10, 5, 30, 0, 25, 12, 40, 0, 8, 25, 18, 10],
  "4": [0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 3, 0, 0],
  "5": [40, 60, 0, 90, 30, 0, 55, 20, 0, 0, 70, 45, 0, 95],
}
const STREAK: Record<string, number> = { "1": 12, "2": 3, "3": 1, "4": 6, "5": 0 }
const PERIOD_SHORT = { day: "día", week: "semana", month: "mes" } as const

// good = piso (llegar al target), bad = techo (no pasarlo). Mismo cálculo, signo distinto.
const isMet = (h: Habit, total: number) => (h.kind === "good" ? total >= h.target : total <= h.target)
const unit = (h: Habit) => (h.metric === "time" ? " min" : "")

// El label sale de la métrica, no del kind: un object-map, no un switch.
// "7/0" no quiere decir nada: con techo cero no hay fracción posible, cualquier registro ya es
// pasarse. Ahí va el número solo y el techo lo dice el tooltip. Con techo > 0 (`230/120 min`) la
// fracción sí informa cuánto te pasaste, y se queda.
const ratioLabel = (h: Habit, t: number) =>
  h.kind === "bad" && h.target === 0 ? `${t}` : `${t}/${h.target}`

const LABEL: Record<Habit["metric"], (h: Habit, t: number) => string> = {
  check: (_h, t) => (t > 0 ? "hecho" : "hoy"),
  count: ratioLabel,
  time: (h, t) => `${ratioLabel(h, t)} min`,
}

// "3/día", "25 min/día", "máx 0/día" — la meta en una línea, sin depender del kind para leerse.
const goal = (h: Habit) =>
  `${h.kind === "bad" ? "máx " : ""}${h.target}${unit(h)}/${PERIOD_SHORT[h.period]}`

// Un día no es sí/no cuando la métrica es tiempo o cantidad: si la meta diaria son 25 min y hiciste
// 10, ese día no es rojo ni verde pleno — es verde al 40%. Se mezcla contra --muted (no contra
// transparent) para que la escala se dé vuelta sola entre tema claro y oscuro.
function dayColor(h: Habit, amount: number) {
  if (amount === 0) return undefined // el cero es el paso más apagado, lo pone la clase
  const perDay = h.period === "day" ? h.target : h.period === "week" ? h.target / 7 : h.target / 30
  const ratio = Math.min(1, amount / Math.max(perDay, 1))
  const color = h.kind === "good" ? "var(--brand)" : "var(--destructive)"
  return `color-mix(in oklab, ${color} ${Math.round(25 + ratio * 75)}%, var(--muted))`
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

// El estado es el historial: editar hoy mueve el chip y el tooltip a la vez, que es justo lo que
// hay que poder mirar antes de escribir el código de verdad.
function useFakeHabits() {
  const [hist, setHist] = useState(HISTORY)
  const days = (h: Habit) => hist[h.id]
  const today = (h: Habit) => hist[h.id][DAYS - 1]
  const total = (h: Habit) =>
    h.period === "day" ? today(h) : sum(hist[h.id].slice(h.period === "week" ? -7 : 0))

  // Todo pasa por acá: sumar, togglear y editar son la misma escritura sobre el día de hoy.
  const setToday = useCallback((h: Habit, value: number) => {
    setHist((prev) => ({
      ...prev,
      [h.id]: prev[h.id].map((v, i) => (i === DAYS - 1 ? Math.max(0, value) : v)),
    }))
  }, [])
  const add = useCallback(
    (h: Habit, amount = 1) =>
      setHist((prev) => ({
        ...prev,
        [h.id]: prev[h.id].map((v, i) => (i === DAYS - 1 ? Math.max(0, v + amount) : v)),
      })),
    [],
  )

  return { days, today, total, setToday, add }
}

// ── Cronómetro ────────────────────────────────────────────────────────────────────────────────
// Un solo timer a la vez, en localStorage (mismo criterio que `bita-pinned-courses`: estado de UI
// vivo, no dato de negocio — recién al terminar entra una fila en habit_log).
// ponytail: uno global. Timers paralelos por hábito el día que alguien lea y corra a la vez.
type Timer = { habitId: string; startedAt: number; minutes: number }
const TIMER_KEY = "bita-timer-proto"
// Los dos padStart son por el ancho, no por estética: un contador que va de "0:05" a "12:34"
// cambia de 4 a 5 caracteres y empuja todo lo que tiene a la derecha.
const mmss = (ms: number) =>
  `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`

// El chunk que arranca el ▶: en un hábito diario es la meta entera; en semanal/mensual, 30 min,
// porque nadie corre un cronómetro de 150 minutos de una sentada.
const chunk = (h: Habit) => (h.period === "day" ? h.target : 30)

function useTimer(onDone: (habitId: string, minutes: number) => void) {
  const [timer, setTimer] = useState<Timer | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(TIMER_KEY) ?? "null")
    } catch {
      return null
    }
  })
  const [, tick] = useState(0)

  function save(t: Timer | null) {
    setTimer(t)
    if (t) localStorage.setItem(TIMER_KEY, JSON.stringify(t))
    else localStorage.removeItem(TIMER_KEY)
  }

  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => {
      // El tiempo sale SIEMPRE de Date.now() - startedAt, nunca de contar ticks: un tab en
      // background throttlea el interval y el contador se atrasaría.
      if (Date.now() - timer.startedAt >= timer.minutes * 60_000) {
        onDone(timer.habitId, timer.minutes)
        notify(timer.minutes)
        save(null)
      } else tick((n) => n + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [timer, onDone])

  return {
    timer,
    elapsed: timer ? Date.now() - timer.startedAt : 0,
    start(h: Habit) {
      if (Notification?.permission === "default") Notification.requestPermission()
      save({ habitId: h.id, startedAt: Date.now(), minutes: chunk(h) })
    },
    stop() {
      if (!timer) return
      const mins = Math.round((Date.now() - timer.startedAt) / 60_000)
      if (mins >= 1) onDone(timer.habitId, mins) // cortar antes cuenta lo que sí hiciste
      save(null)
    },
  }
}

// ponytail: la notificación sólo llega con la app abierta (aunque el tab esté de fondo). Push real
// con la app cerrada necesita service worker + servidor que lo dispare — rompe el "$0" de
// CONTEXT.md:27. El toast es el fallback si el permiso está denegado.
function notify(minutes: number) {
  toast.success(`${minutes} min listos`)
  if (Notification?.permission === "granted") {
    new Notification("Bitácora", { body: `Terminaste tus ${minutes} min.` })
  }
}

// ── Chips ─────────────────────────────────────────────────────────────────────────────────────
// Dos gestos, y cuál es cuál lo decide la métrica:
//   · check → el chip es un TOGGLE. Marcar y desmarcar es todo lo que existe: no hay dialog.
//   · count → click suma 1 · `⌄` abre el editor de hoy (bajar, subir, poner el número exacto).
//   · time  → click arranca el cronómetro · `⌄` edita los minutos de hoy.

// El spread va porque `TooltipTrigger asChild` inyecta handlers y ref en la raíz del chip.
type ChipProps = ComponentProps<"div"> & {
  h: Habit
  n: number
  total: number
  met: boolean
  over: boolean
  pct: number
  running: boolean
  elapsed: number
  onQuick: () => void
  onEdit: () => void
}

const quickLabel = (h: Habit, running: boolean) =>
  running
    ? `Cortar ${h.name}`
    : h.kind === "bad"
      ? `Registrar recaída de ${h.name}`
      : `Registrar ${h.name}`

// Un `check` no tiene nada que editar: o lo hiciste o no — ahí no se renderiza, y como nunca
// cambia no mueve nada. Con el cronómetro corriendo tampoco se edita, pero el botón NO se
// desmonta: sacarlo encoge el chip justo al arrancar el timer, que es el salto más molesto.
function EditNib({ h, running, onEdit }: { h: Habit; running: boolean; onEdit: () => void }) {
  if (h.metric === "check") return null
  return (
    <button
      type="button"
      aria-label={`Editar ${h.name} de hoy`}
      onClick={onEdit}
      disabled={running}
      className={cn(
        "relative cursor-pointer rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground",
        !running && "group-hover:opacity-100 focus-visible:opacity-100",
      )}
    >
      <ChevronDown size={13} />
    </button>
  )
}

// Sólo si es ≥ 2: un `🔥 0` es ruido.
function Streak({ id }: { id: string }) {
  if (STREAK[id] < 2) return null
  return (
    <span className="mono-dim relative inline-flex items-center gap-0.5 text-[10px]">
      <Flame size={10} />
      {STREAK[id]}
    </span>
  )
}

// El cronómetro se ve igual en las cuatro: el tiempo corriendo manda sobre cualquier otro dato.
function Running({ elapsed }: { elapsed: number }) {
  return (
    <span className="mono relative text-brand-fg text-xs tabular-nums">
      {mmss(elapsed)}
      <Square size={9} fill="currentColor" className="ml-1.5 inline" />
    </span>
  )
}

// El progreso es el fondo del chip: continuo, y con la fracción exacta al lado — dice la forma y el
// número a la vez sin obligarte a elegir. Le ganó al anillo y al subrayado (esconden el número) y a
// los segmentos (se rompen con metas de 150 min y con techo 0), a cambio de ser el chip más ancho.

// El relleno no tiene color propio: se MEZCLA — rojo lo que falta, verde lo hecho. A 10% el chip
// es casi todo rojo, a mitad de camino es ámbar sucio, cumplido es verde. El color dice el número
// una segunda vez, para el vistazo de medio segundo que no lee la fracción.
// En un `bad` la escala va al revés (llenarse es perder): 0% verde, techo rojo.
// ponytail: la mezcla se rebaja contra --card, no contra transparent — es lo que mantiene legible
// el texto de arriba y lo que hace que la escala se dé vuelta sola entre tema claro y oscuro.
// Piso de ancho del slot del dato — por métrica, porque lo que puede llegar a mostrar cada una es
// distinto: un `check` no pasa de "hoy", un `time` va de "00:05" a "230/120 min ▶". Sin este piso
// el chip (y la tira entera, que es flex) se reacomoda cada segundo mientras corre el cronómetro.
const SLOT: Record<Habit["metric"], string> = {
  check: "min-w-8",
  count: "min-w-10",
  time: "min-w-24",
}

const MIX = 30 // cuánto pesa el color contra el fondo del card
function fillColor(h: Habit, pct: number) {
  const done = Math.round(h.kind === "good" ? pct : 100 - pct)
  const scale = `color-mix(in oklab, var(--brand) ${done}%, var(--destructive))`
  return `color-mix(in oklab, ${scale} ${MIX}%, var(--card))`
}
function Chip({ h, n, total, met, over, pct, running, elapsed, onQuick, onEdit, ...rest }: ChipProps) {
  return (
    <div
      {...rest}
      className={cn(
        "group relative flex items-center gap-2 overflow-hidden rounded-full border pr-1.5 pl-3 text-sm transition-colors",
        // El punteado es el estado "esto es un hábito malo, todavía vas bien". Pasado el techo el
        // borde se cierra: ya no hay margen, el chip está lleno y se ve lleno.
        h.kind === "bad" && !over && "border-dashed",
        over
          ? "border-destructive text-destructive"
          : met && h.kind === "good"
            ? "border-brand/50"
            : "border-border",
        rest.className,
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
        className="relative flex cursor-pointer items-center gap-2 py-1.5"
      >
        <span className="mono-dim text-[10px] opacity-50">{n}</span>
        <span className={cn(met && h.kind === "good" && "text-brand-fg")}>{h.name}</span>

        {/* Todo lo que cambia vive adentro de un slot con ancho mínimo: la fracción crece con el
            total, el ▶ desaparece cuando arranca el cronómetro y el ✓ reemplaza al "hoy". Que
            nada de eso mueva la racha ni el `⌄` es la diferencia entre una tira quieta y una que
            late. */}
        <span className={cn("flex items-center justify-center gap-1.5", SLOT[h.metric])}>
          {running ? (
            <Running elapsed={elapsed} />
          ) : h.metric === "check" ? (
            met ? (
              <Check size={13} strokeWidth={3} className="text-brand-fg" />
            ) : (
              <span className="mono-dim text-xs">hoy</span>
            )
          ) : (
            <span className="mono text-xs tabular-nums">{LABEL[h.metric](h, total)}</span>
          )}

          {h.metric === "time" && !running && (
            <Play size={10} fill="currentColor" className="text-muted-foreground" />
          )}
          {/* En un `bad` de tiempo el gesto ya es el ▶ (medir la recaída): dos íconos dirían lo
              mismo dos veces. */}
          {h.kind === "bad" && h.metric !== "time" && !running && (
            <Minus size={11} className="opacity-50" />
          )}
        </span>

        <Streak id={h.id} />
      </button>

      <EditNib h={h} running={running} onEdit={onEdit} />
    </div>
  )
}

export function HabitsPrototype() {
  const state = useFakeHabits()
  const [editing, setEditing] = useState<Habit | null>(null)
  const onTimerDone = useCallback(
    (habitId: string, minutes: number) => {
      const h = HABITS.find((x) => x.id === habitId)
      if (h) state.add(h, minutes)
    },
    [state],
  )
  const clock = useTimer(onTimerDone)

  // La acción rápida: la misma que dispara el chord h>N.
  const quick = useCallback(
    (h: Habit) => {
      if (clock.timer?.habitId === h.id) return clock.stop()
      if (h.metric === "time") return clock.start(h)
      if (h.metric === "check") return state.setToday(h, state.today(h) > 0 ? 0 : 1) // toggle
      state.add(h)
    },
    [clock, state],
  )

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      {HABITS.map((h, i) => {
        const total = state.total(h)
        const met = isMet(h, total)
        const running = clock.timer?.habitId === h.id
        const over = h.kind === "bad" && !met
        // Relleno = cuánto del período llevo. En un `bad` es cuánto me queda antes de pasarme.
        const pct = running
          ? (clock.elapsed / (clock.timer!.minutes * 60_000)) * 100
          : Math.min(100, (total / Math.max(h.target, 1)) * 100)

        return (
          <Tooltip key={h.id}>
            <TooltipTrigger asChild>
              <Chip
                h={h}
                n={i + 1}
                total={total}
                met={met}
                over={over}
                pct={pct}
                running={running}
                elapsed={clock.elapsed}
                onQuick={() => quick(h)}
                onEdit={() => setEditing(h)}
              />
            </TooltipTrigger>

            {/* Los 14 días no se van: se mudan al hover, que es cuando te importan. */}
            <TooltipContent className="flex flex-col gap-1.5">
              <span className="mono-dim text-[10px]">{goal(h)} · últimos 14 días</span>
              <span className="flex gap-1">
                {state.days(h).map((amount, d) => (
                  <span
                    key={d}
                    title={`${amount}${unit(h)}`}
                    style={{ backgroundColor: dayColor(h, amount) }}
                    className={cn(
                      "size-2 rounded-[2px]",
                      // Sólo el día en cero usa clase: el resto lo pinta color-mix por fracción.
                      amount === 0 && (h.kind === "good" ? "bg-muted" : "bg-brand/40"),
                    )}
                  />
                ))}
              </span>
            </TooltipContent>
          </Tooltip>
        )
      })}

      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Nuevo hábito"
      >
        <Plus size={14} />
      </button>

      {HABITS.map((h, i) => (
        <HabitHotkey key={h.id} n={i + 1} onHit={() => quick(h)} />
      ))}

      {editing && (
        <EditToday
          habit={editing}
          value={state.today(editing)}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            state.setToday(editing, v)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

// El dialog EDITA lo de hoy, no registra una entrada nueva: se abre con el número actual, y podés
// bajarlo, subirlo o escribirlo. Es la única forma de corregir un mis-tap sin borrar historial.
function EditToday({
  habit,
  value,
  onClose,
  onSave,
}: {
  habit: Habit
  value: number
  onClose: () => void
  onSave: (v: number) => void
}) {
  const [v, setV] = useState(value)
  const step = habit.metric === "time" ? 5 : 1
  const presets = habit.metric === "time" ? [0, 10, 25, 45, 60] : [0, 1, 2, 3, 5]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{habit.name} — hoy</DialogTitle>
          <DialogDescription>
            {goal(habit)} · antes: {value}
            {unit(habit)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3">
          <Button size="icon" variant="outline" onClick={() => setV((n) => Math.max(0, n - step))}>
            <Minus size={14} />
          </Button>
          <input
            type="number"
            min={0}
            value={v}
            onChange={(e) => setV(Math.max(0, Number(e.target.value) || 0))}
            className="w-20 rounded-md border bg-background px-2 py-1 text-center text-2xl tabular-nums"
          />
          <Button size="icon" variant="outline" onClick={() => setV((n) => n + step)}>
            <Plus size={14} />
          </Button>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {presets.map((p) => (
            <Button key={p} size="sm" variant={p === v ? "default" : "outline"} onClick={() => setV(p)}>
              {p}
              {unit(habit)}
            </Button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(v)}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Un componente = un hook por dígito: la lib comparte el buffer de secuencia entre atajos de la
// misma llamada, así que "h>1","h>2",... se pisarían (mismo motivo que CourseHotkey en app.tsx).
function HabitHotkey({ n, onHit }: { n: number; onHit: () => void }) {
  useHotkeys(`h>${n}`, onHit, { sequenceTimeoutMs: 900, preventDefault: true }, [onHit])
  return null
}
