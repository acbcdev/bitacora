// PROTOTIPO — TIRAR. Cuatro variantes del paginador del card de Repaso, en la MISMA ruta `/`,
// conmutables con `?variant=0|A|B|C` desde la barra flotante de abajo.
//
// Pregunta que responde: el "1 / 3" arriba a la derecha es ambiguo (se confunde con "leídas hoy
// 3/3", que es otra cosa) y navegar con él falla:
//   1. vive DENTRO del <button> que abre la nota → clickearlo abre la nota ("entrar en él").
//   2. K en el último ítem manda a index === queue.length → cae en "Batch terminado" sin querer
//      ("pasar de él").
// Las tres variantes sacan la navegación de adentro del botón, dicen "del batch" para no chocar
// con la meta diaria, y hacen explícito el terminar.

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { Button } from "@/core/ui/button"
import { cn } from "@/core/lib/utils"

export type PagerProps = {
  index: number
  total: number
  isRead: (i: number) => boolean
  titleAt: (i: number) => string
  onGo: (i: number) => void
  onFinish: () => void
}

// A — rail de segmentos: un segmento por ítem del batch, estado a la vista (leído / actual /
// pendiente), clickeable. El contador de la esquina desaparece.
function RailNav({ index, total, isRead, onGo, onFinish }: PagerProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ir a la nota ${i + 1} del batch`}
            aria-current={i === index}
            onClick={() => onGo(i)}
            className={cn(
              "h-1.5 flex-1 cursor-pointer rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              i === index
                ? "bg-brand"
                : isRead(i)
                  ? "bg-brand/40"
                  : "bg-muted hover:bg-muted-foreground/40",
            )}
          />
        ))}
        <button
          type="button"
          onClick={onFinish}
          className="mono-dim ml-2 cursor-pointer hover:text-foreground"
        >
          terminar
        </button>
      </div>
      <p className="mono-dim mt-2">
        nota {index + 1} de {total} del batch
      </p>
    </div>
  )
}

// B — navegación en el footer, al lado de Marcar leído: flechas explícitas, deshabilitadas en los
// bordes, y en el último ítem la flecha de siguiente se vuelve "Terminar".
function FooterNav({ index, total, onGo, onFinish }: PagerProps) {
  const last = index === total - 1
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Nota anterior"
        disabled={index === 0}
        onClick={() => onGo(index - 1)}
      >
        <ChevronLeft />
      </Button>
      <span className="mono-dim whitespace-nowrap">
        nota {index + 1} de {total} del batch
      </span>
      {last ? (
        <Button variant="ghost" size="sm" className="ml-1" onClick={onFinish}>
          Terminar
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Nota siguiente"
          onClick={() => onGo(index + 1)}
        >
          <ChevronRight />
        </Button>
      )}
    </div>
  )
}

// C — sin fracciones: arriba dice cuántas quedan, y debajo del card asoma la siguiente nota como
// tira clickeable. El final del batch es una tira más, no un salto al vacío.
function RemainingNav({ index, total }: PagerProps) {
  const left = total - index - 1
  return (
    <p className="mono-dim mb-6">
      {left === 0 ? "última del batch" : `quedan ${left} después de esta`}
    </p>
  )
}

function PeekStrip({ index, total, titleAt, onGo, onFinish }: PagerProps) {
  const last = index === total - 1
  return (
    <button
      type="button"
      onClick={() => (last ? onFinish() : onGo(index + 1))}
      className="-mt-4 mb-8 block w-full cursor-pointer rounded-xl border border-dashed px-6 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="eyebrow block">{last ? "Fin del batch" : "Siguiente"}</span>
      <span className="mt-1 line-clamp-1 block text-muted-foreground">
        {last ? "Terminar repaso" : titleAt(index + 1) || "(sin título)"}
      </span>
    </button>
  )
}

type Pager = {
  name: string
  clampLast: boolean // K no puede pasarse del último ítem (el salto accidental a "Batch terminado")
  Nav?: (p: PagerProps) => React.ReactElement
  Footer?: (p: PagerProps) => React.ReactElement
  Below?: (p: PagerProps) => React.ReactElement
}

export const PAGERS: Record<string, Pager> = {
  "0": { name: "Actual (1 / 3 en la esquina)", clampLast: false },
  A: { name: "Rail de segmentos", clampLast: true, Nav: RailNav },
  B: { name: "Nav en el footer", clampLast: true, Footer: FooterNav },
  C: { name: "Quedan N + peek", clampLast: true, Nav: RemainingNav, Below: PeekStrip },
}

const KEYS = Object.keys(PAGERS)

export function useVariant() {
  const [params, setParams] = useSearchParams()
  const key = params.get("variant") ?? "0"
  const variant = KEYS.includes(key) ? key : "0"

  function go(step: number) {
    const next = KEYS[(KEYS.indexOf(variant) + step + KEYS.length) % KEYS.length]
    const p = new URLSearchParams(params)
    p.set("variant", next)
    setParams(p, { replace: true })
  }

  useHotkeys("left", () => go(-1), { preventDefault: true }, [variant, params])
  useHotkeys("right", () => go(1), { preventDefault: true }, [variant, params])

  return { variant, pager: PAGERS[variant], go }
}

export function PrototypeSwitcher({
  variant,
  go,
}: {
  variant: string
  go: (step: number) => void
}) {
  if (!import.meta.env.DEV) return null
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground py-1.5 pr-2 pl-1.5 text-background shadow-lg">
      <button
        type="button"
        aria-label="Variante anterior"
        onClick={() => go(-1)}
        className="cursor-pointer rounded-full px-2 py-1 hover:bg-background/20"
      >
        ←
      </button>
      <span className="font-mono text-xs whitespace-nowrap">
        {variant} — {PAGERS[variant].name}
      </span>
      <button
        type="button"
        aria-label="Variante siguiente"
        onClick={() => go(1)}
        className="cursor-pointer rounded-full px-2 py-1 hover:bg-background/20"
      >
        →
      </button>
    </div>
  )
}
