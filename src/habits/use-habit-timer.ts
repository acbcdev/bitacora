import { useCallback, useEffect, useMemo, useState } from "react"
import { deriveHabit, parseDay } from "@/habits/habits"
import { useSetDay } from "@/habits/habits.api"
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
import type { HabitLogRow } from "@/core/store/types"
import type { Habit } from "@/core/types/database"

// La máquina de estado del Cronómetro.
// `habit-timer.ts` es el seam puro (no conoce el store); acá se cruza con el log y con useSetDay.
export function useHabitTimer(habits: Habit[], log: HabitLogRow[]) {
  const setDay = useSetDay()
  const timer = useTimer()
  const [, tick] = useState(0)

  // El interval sólo repinta: el transcurrido sale siempre de Date.now() - startedAt, nunca de
  // contar ticks — un tab en background throttlea el interval.
  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  // Pausar escribe en el DÍA DE ATRIBUCIÓN (startedDay): todo el elapsed va al día en que el
  // timer arrancó, aunque la pausa caiga pasada la medianoche (spec habit-timer-attribution).
  // La base es la fila de startedDay — no la de hoy ni el total del período.
  const writePause = useCallback(
    (h: Habit, t: Timer) => {
      const base = log.find((r) => r.habit_id === h.id && r.day === t.startedDay)?.amount ?? 0
      const value = pausedValue(base, t)
      if (value !== null) setDay.mutate({ habit: h, day: t.startedDay, value })
    },
    [setDay, log],
  )

  const running = habits.find((h) => h.id === timer?.habitId)
  // El estado que importa es el del DÍA DE ATRIBUCIÓN: ahí cae la escritura y ahí corre el
  // auto-finish — el período que contiene startedDay, no el de hoy.
  const startedState = useMemo(
    () => (running && timer ? deriveHabit(running, log, parseDay(timer.startedDay)) : null),
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
    running.kind === "good" &&
    startedState.total < running.target &&
    shown >= running.target

  // Llegar a la meta guarda y apaga solo. Depende únicamente de `reached` a propósito: finishTimer
  // limpia el localStorage, así que el efecto se auto-desarma en el render siguiente.
  useEffect(() => {
    if (!reached || !running || !timer) return
    writePause(running, timer)
    finishTimer(running.name, shown)
    // oxlint-disable-next-line exhaustive-deps
  }, [reached])

  const toggle = useCallback(
    (h: Habit) => {
      if (timer?.habitId === h.id) {
        writePause(h, timer)
        return clearTimer()
      }
      // Un timer a la vez, pero arrancar otro no pierde lo que iba corriendo.
      if (running && timer) writePause(running, timer)
      return startTimer(h.id)
    },
    [timer, running, writePause],
  )

  return { runningId: running?.id ?? null, shown, clock, toggle }
}
