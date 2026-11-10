import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import type { Habit } from "@/core/types/database"

// Cumplir un hábito lo mandaba al fondo de la tira en el mismo frame — y con >6, adentro del
// plegado: desaparecía sin decir a dónde. Ahora se QUEDA en su lugar LINGER ms (barrido verde +
// barra que se vacía), sale con fade y recién ahí se reordena; el fold avisa "✓ X cumplido".
// La ventana es también un deshacer gratis: ↺ antes de que termine y el tile nunca se movió.
//
// Se detecta la transición pendiente→cumplido en el dato, no en el click: así cubre igual el
// tap, el chord h>N, la pausa de un `time` que llega a la meta y la corrección del panel.
export const LINGER = 1800
const LEAVE = 200
const ARRIVED = 2600

// View Transitions nativas: los tiles con view-transition-name se deslizan al hueco (FLIP del
// browser). Sin soporte o con reduced-motion, cambio seco.
function transition(fn: () => void) {
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches)
    return fn()
  document.startViewTransition(() => flushSync(fn))
}

export function useHabitLinger(entries: { h: Habit; state: { met: boolean } }[]) {
  const [lingering, setLingering] = useState<ReadonlySet<string>>(new Set())
  const [leaving, setLeaving] = useState<string | null>(null)
  const [arrived, setArrived] = useState<string | null>(null)
  const prev = useRef(new Map<string, boolean>())
  const timers = useRef(new Map<string, number>())

  useEffect(() => {
    const drop = (id: string) => (s: ReadonlySet<string>) => {
      const n = new Set(s)
      n.delete(id)
      return n
    }
    for (const { h, state } of entries) {
      const was = prev.current.get(h.id)
      prev.current.set(h.id, state.met)
      // Solo los buenos celebran: un `bad` "cumplido" es no haber recaído, no un logro del momento.
      if (was === undefined || was === state.met || h.kind === "bad") continue
      clearTimeout(timers.current.get(h.id))
      if (!state.met) {
        // Deshecho dentro de la ventana: se cancela la salida.
        setLingering(drop(h.id))
        continue
      }
      setLingering((s) => new Set(s).add(h.id))
      timers.current.set(
        h.id,
        window.setTimeout(() => {
          setLeaving(h.id)
          window.setTimeout(() => {
            transition(() => {
              setLeaving(null)
              setLingering(drop(h.id))
            })
            setArrived(h.id)
            window.setTimeout(() => setArrived((a) => (a === h.id ? null : a)), ARRIVED)
          }, LEAVE)
        }, LINGER),
      )
    }
  }, [entries])

  return { lingering, leaving, arrived }
}
