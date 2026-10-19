import { Check, Circle, Flame } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/core/lib/utils"
import { HabitDots } from "@/habits/habit-dots"
import { displayAmount, displayTarget, goalText, streakText, unit } from "@/habits/habits"
import type { DayCell } from "@/core/store/derive"
import type { Habit, HabitMetric } from "@/core/types/database"

// "7/0" no quiere decir nada: con techo cero cualquier registro ya es pasarse, así que va el
// número solo. Con techo > 0 la fracción sí informa cuánto te pasaste.
// Para time, t y h.target vienen en segundos (0011) — se muestran en min.
const zeroCeiling = (h: Habit) => h.kind === "bad" && displayTarget(h) === 0

const ratio = (h: Habit, t: number) =>
  zeroCeiling(h) ? `${displayAmount(h, t)}` : `${displayAmount(h, t)}/${displayTarget(h)}`

// Los tres estados vivos de un `time`. "Pausado" NO es un dato nuevo: pausar ya escribe los
// minutos en habit_log y borra el cronómetro (habit-timer.ts), así que sale de lo que ya hay —
// algo hecho, nada corriendo, y todavía falta. Sin campo nuevo y sin migración.
export type Run = { running: boolean; clock: string | null; paused: boolean }

// Estado visual del tile (spec "Hábito"). Una sola señal: verde = cumplido/vivo, rojo = te
// pasaste — solo en texto e ícono, nunca relleno (ADR 0023).
export type Tone = "over" | "done" | "clean" | "off" | "idle"

export const tileTone = (h: Habit, total: number, met: boolean): Tone => {
  if (h.kind === "bad") {
    if (!met) return "over"
    return total === 0 ? "clean" : "idle"
  }
  if (met) return "done"
  return total === 0 ? "off" : "idle"
}

const TONE: Record<Tone, string> = {
  over: "text-destructive",
  done: "text-signal",
  clean: "",
  off: "text-muted-foreground",
  idle: "",
}

// Etiqueta corta junto al nombre: dice en qué estado está, el número grande dice cuánto.
const LABEL: Record<HabitMetric, (h: Habit, t: number) => ReactNode> = {
  check: (_h, t) => (t > 0 ? <Check size={14} strokeWidth={3} /> : "hoy"),
  count: ratio,
  time: (h, t) => `${ratio(h, t)} min`,
}

function StatusLabel({ h, total, r, tone }: { h: Habit; total: number; r: Run; tone: Tone }) {
  // Corriendo el dato pasa a reloj con punto que pulsa; pausado = punto fijo.
  if (r.running)
    return (
      <span className="inline-flex items-center gap-1.5 text-signal">
        <i aria-hidden className="size-1.5 animate-pulse rounded-full bg-current" />
        {r.clock}
      </span>
    )
  // Pasarse gana a "pausado": un `bad` time sobre el techo también cumple paused (!met).
  if (tone === "over")
    return <span className="text-destructive">+{displayAmount(h, total - h.target)}</span>
  if (r.paused)
    return (
      <span className="inline-flex items-center gap-1.5">
        <i aria-hidden className="size-1.5 rounded-full bg-current" />
        pausado
      </span>
    )
  if (tone === "clean") return <span className="text-signal">limpio</span>
  // Cumplido = check verde en count/time, junto a su fracción. En check el ✓ grande ya está en
  // el hero: acá va texto para no repetirlo.
  if (tone === "done")
    return h.metric === "check" ? (
      <span className="text-signal">hecho</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-signal">
        <Check role="img" aria-label="cumplido" size={14} strokeWidth={3} />
        {LABEL[h.metric](h, total)}
      </span>
    )
  return <span>{LABEL[h.metric](h, total)}</span>
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

// Cabecera del tile: nombre + etiqueta de estado. El click lo pone la fila entera (HabitTile).
export function HabitTileInfo({
  h,
  total,
  r,
  tone,
}: {
  h: Habit
  total: number
  r: Run
  tone: Tone
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="block truncate text-[14px] font-medium leading-none">{h.name}</span>
      <span
        className={cn(
          "flex h-3.5 items-center font-mono text-xs leading-none tabular-nums",
          tone !== "over" && "text-muted-foreground",
        )}
      >
        <StatusLabel h={h} total={total} r={r} tone={tone} />
      </span>
    </span>
  )
}

// Número grande + pie (meta, racha, dots 7d).
export function HabitTileValue({
  h,
  state,
  total,
  r,
  tone,
  onHero,
}: {
  h: Habit
  state: { streak: number; days: DayCell[] }
  total: number
  r: Run
  tone: Tone
  onHero: () => void
}) {
  const sub = zeroCeiling(h) ? "" : `/${displayTarget(h)}${unit(h)}`
  return (
    <>
      {/* 40px en 300 dark / 400 light: claro sobre oscuro engorda, oscuro sobre claro adelgaza.
          El hero es zona de click en toda métrica (mouse-only, igual que la fila de arriba). */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onHero}
        className={cn(
          "flex w-fit cursor-pointer items-baseline text-[40px] leading-none font-normal tracking-tighter tabular-nums dark:font-light",
          TONE[tone],
        )}
      >
        {h.metric === "check" ? (
          total > 0 ? (
            <Check className="size-[38px]" strokeWidth={2.25} />
          ) : (
            <Circle className="size-[38px]" strokeWidth={1.5} strokeDasharray="3 3" />
          )
        ) : (
          <>
            {r.running ? r.clock : displayAmount(h, total)}
            <small className="ml-0.5 text-[13px] font-normal tracking-normal text-muted-foreground">
              {sub}
            </small>
          </>
        )}
      </button>
      <span className="flex items-center justify-between gap-2 font-mono text-[11px] leading-none text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{goalText(h)}</span>
          {state.streak >= 2 && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Flame size={10} />
              {streakText(h, state.streak)}
            </span>
          )}
        </span>
        <HabitDots h={h} dots={state.days.slice(-7)} />
      </span>
    </>
  )
}
