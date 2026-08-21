import { useMemo, useSyncExternalStore } from "react"
import { toast } from "sonner"

// Cronómetro de los hábitos `time`: cuenta para ARRIBA desde lo que ya llevás del período.
// Play sobre 15 minutos sigue en 15 — la base sale de la DB, no de cero.
//
// Un solo timer a la vez, con dos campos en localStorage (mismo criterio que pinned-courses.ts:
// estado de UI vivo, no dato de negocio — el dato entra en habit_log al pausar).
// ponytail: uno global. Timers paralelos por hábito el día que alguien lea y corra a la vez.
export type Timer = { habitId: string; startedAt: number }

export const TIMER_KEY = "bita-timer"

const listeners = new Set<() => void>()

function parse(raw: string | null): Timer | null {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function readTimer() {
  return parse(localStorage.getItem(TIMER_KEY))
}

// El snapshot es el STRING crudo, no el objeto parseado: useSyncExternalStore compara por
// identidad, y parsear en cada llamada devolvería un objeto nuevo cada vez (render infinito).
export function useTimer(): Timer | null {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => localStorage.getItem(TIMER_KEY),
  )
  return useMemo(() => parse(raw), [raw])
}

export function startTimer(habitId: string) {
  // El permiso se pide al arrancar el primer cronómetro, no al montar la tira: pedirlo sin que el
  // usuario haya hecho nada es lo que hace que lo denieguen.
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission()
  }
  localStorage.setItem(TIMER_KEY, JSON.stringify({ habitId, startedAt: Date.now() }))
  listeners.forEach((l) => l())
}

export function clearTimer() {
  localStorage.removeItem(TIMER_KEY)
  listeners.forEach((l) => l())
}

// Siempre Date.now() - startedAt, NUNCA contando ticks del setInterval: un tab en background lo
// throttlea y el contador se atrasaría. `round` y no `floor` para que el error de cada pausa se
// compense en vez de acumularse hacia abajo (±30s, ADR 0009).
export function elapsedMinutes(t: Timer, now = Date.now()) {
  return Math.round((now - t.startedAt) / 60_000)
}

// Lo que muestra el tile mientras corre: lo acumulado del período (DB) + lo que va del cronómetro.
export function shownMinutes(amount: number, t: Timer, now = Date.now()) {
  return amount + elapsedMinutes(t, now)
}

// Lo que hay que escribir al pausar o al llegar a la meta. `null` = menos de medio minuto, no hay
// nada que sumar. El timer no es un camino de escritura especial: esto va al mismo useSetDay que
// el click y el panel, así que el panel puede corregirlo después como cualquier otro número.
export function pausedValue(amount: number, t: Timer, now = Date.now()): number | null {
  const mins = elapsedMinutes(t, now)
  return mins > 0 ? amount + mins : null
}

// ponytail: la notificación sólo llega con la app abierta (el tab puede estar de fondo). Push con
// la app cerrada necesita service worker + servidor que lo dispare — rompe el "$0, sin servidores
// propios" de CONTEXT.md. Está en Out of Scope del spec.
// El toast va siempre: es el fallback si el permiso está denegado.
export function finishTimer(name: string, minutes: number) {
  clearTimer()
  toast.success(`${name} — ${minutes} min listos`)
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    // oxlint-disable-next-line no-new -- la notificación es puro efecto, no hay nada que guardar
    new Notification("Bitácora", { body: `Terminaste tus ${minutes} min de ${name}.` })
  }
}
