import { Check, Flame, Minus, Pause } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/core/lib/utils"
import { HabitDots } from "@/habits/habit-dots"
import { goalText, streakText } from "@/habits/habits"
import type { DayCell } from "@/core/store/derive"
import type { Habit, HabitMetric } from "@/core/types/database"

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
export type Run = { running: boolean; clock: string | null; paused: boolean }

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

// Tres gestos, tres verbos. "Cortar" mentía: el click sobre un cronómetro corriendo GUARDA los
// minutos y pausa, no descarta nada.
export const quickLabel = (h: Habit, r: Run) =>
  r.running
    ? `Pausar ${h.name}`
    : r.paused
      ? `Reanudar ${h.name}`
      : h.kind === "bad"
        ? `Registrar recaída de ${h.name}`
        : `Registrar ${h.name}`

// Columna central del tile: el nombre (dispara la acción primaria) y la línea de dato/meta/streak.
// Antes inline en habit-tiles.tsx; mismo JSX, extraído tal cual.
export function HabitTileInfo({
  h,
  state,
  total,
  r,
  met,
  onQuick,
}: {
  h: Habit
  state: { streak: number; days: DayCell[] }
  total: number
  r: Run
  met: boolean
  onQuick: () => void
}) {
  return (
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
      <HabitDots h={h} dots={state.days.slice(-7)} />
    </span>
  )
}
