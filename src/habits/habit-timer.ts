import { useMemo, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { dayKey } from "@/core/lib/day"
import { playDoneSound, unlockSound } from "@/habits/sound"

// Cronómetro de los hábitos `time`: cuenta para ARRIBA desde lo que ya llevás del período.
// Play sobre 15 minutos sigue en 15 — la base sale de la DB, no de cero.
//
// Un solo timer a la vez, con tres campos en localStorage (mismo criterio que pinned-notebooks.ts:
// estado de UI vivo, no dato de negocio — el dato entra en habit_log al pausar).
// startedDay = Día de atribución (CONTEXT.md): TODO el elapsed se acredita al día en que arrancó,
// aunque la pausa caiga pasada la medianoche. Se congela acá al start, no se recalcula al pausar.
// ponytail: uno global. Timers paralelos por hábito el día que alguien lea y corra a la vez.
export type Timer = { habitId: string; startedAt: number; startedDay: string }

// Versión en la clave: si la forma cambia, cambiar la clave descarta lo viejo sin crashear.
export const TIMER_KEY = "bita-timer:v1"
const LEGACY_TIMER_KEY = "bita-timer"

const listeners = new Set<() => void>()

function parse(raw: string | null): Timer | null {
  try {
    if (!raw) return null
    const t = JSON.parse(raw) as Timer
    // Fallback de timers viejos sin startedDay (pre habit-timer-attribution): se deriva de
    // startedAt en fecha local, igual que lo habría congelado startTimer.
    t.startedDay ??= dayKey(new Date(t.startedAt))
    return t
  } catch {
    return null
  }
}

function readTimerRaw() {
  return localStorage.getItem(TIMER_KEY) ?? localStorage.getItem(LEGACY_TIMER_KEY)
}

export function readTimer() {
  return parse(readTimerRaw())
}

// El snapshot es el STRING crudo, no el objeto parseado: useSyncExternalStore compara por
// identidad, y parsear en cada llamada devolvería un objeto nuevo cada vez (render infinito).
export function useTimer(): Timer | null {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => readTimerRaw(),
  )
  return useMemo(() => parse(raw), [raw])
}

export function startTimer(habitId: string) {
  // El permiso se pide al arrancar el primer cronómetro, no al montar la tira: pedirlo sin que el
  // usuario haya hecho nada es lo que hace que lo denieguen.
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission()
  }
  // Desbloquea AudioContext dentro del gesto del usuario: sin esto, el beep de finishTimer
  // (que corre segundos/minutos después, fuera de la ventana de "transient activation")
  // quedaría silenciado por la autoplay policy.
  unlockSound()
  const startedAt = Date.now()
  localStorage.setItem(
    TIMER_KEY,
    JSON.stringify({ habitId, startedAt, startedDay: dayKey(new Date(startedAt)) }),
  )
  listeners.forEach((l) => l())
}

export function clearTimer() {
  localStorage.removeItem(TIMER_KEY)
  // También el legacy: un timer en curso que sobrevivió a la subida de versión no debe quedar colgado.
  localStorage.removeItem(LEGACY_TIMER_KEY)
  listeners.forEach((l) => l())
}

// Migración 0011: `amount` y `target` para metric=time ahora son SEGUNDOS.
// Antes eran minutos int con `round` (±30s por pausa, ADR 0009). Ahora son segundos nativos:
// `Math.floor((now - startedAt)/1000)` + amountSec, cero round. La view muestra min con /60.
// La vista muestra min con /60.
export function elapsedSeconds(t: Timer, now = Date.now()) {
  return Math.floor((now - t.startedAt) / 1000)
}

// Lo que hay en DB (segundos) + lo que va del cronómetro, en segundos.
export function shownSeconds(amountSec: number, t: Timer, now = Date.now()) {
  return amountSec + elapsedSeconds(t, now)
}

export function shownClock(amountSec: number, t: Timer, now = Date.now()) {
  const s = shownSeconds(amountSec, t, now)
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

// Lo que hay que escribir al pausar. `null` = menos de 1s, no hay nada que sumar.
// Antes era "menos de medio minuto" (round), ahora 1s porque guardamos segundos exactos.
export function pausedValue(amountSec: number, t: Timer, now = Date.now()): number | null {
  const s = elapsedSeconds(t, now)
  if (s < 1) return null
  return amountSec + s
}

// ponytail: la notificación sólo llega con la app abierta (el tab puede estar de fondo). Push con
// la app cerrada necesita service worker + servidor que lo dispare — rompe el "$0, sin servidores
// propios" de CONTEXT.md. Está en Out of Scope del spec.
// El toast va siempre: es el fallback si el permiso está denegado.
// Recibe SEGUNDOS (0011) y muestra minutos: sin heurística de compat — un valor chico
// ("45 segundos") no puede colarse como "45 min".
export function finishTimer(name: string, seconds: number) {
  clearTimer()
  playDoneSound()
  const mins = Math.round(seconds / 60)
  toast.success(`${name} — ${mins} min listos`)
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    // oxlint-disable-next-line no-new -- la notificación es puro efecto, no hay nada que guardar
    new Notification("Bitácora", { body: `Terminaste tus ${mins} min de ${name}.` })
  }
}
