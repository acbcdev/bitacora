import { useEffect, useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import type { ProviderConfig } from "@/core/agent/provider"
import { ollamaWindow } from "@/core/agent/capabilities"
import { cn } from "@/core/lib/utils"
import type { ContextPart } from "@/core/agent/context"
import type { Meter } from "@/core/agent/chats"
import {
  FileOutput,
  MessageSquare,
  Paperclip,
  ScrollText,
  Sparkles,
  SquareDashed,
  Wrench,
  type LucideIcon,
} from "lucide-react"

type Tokens = { input: number; output: number }

const R = 7
const C = 2 * Math.PI * R

const fmt = (n: number) =>
  n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${n}`
const usd = (n: number) => (n === 0 ? "gratis" : n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`)
const cost = (t: Tokens, p: [number, number]) => (t.input * p[0] + t.output * p[1]) / 1e6

const PARTS: [ContextPart, string, LucideIcon][] = [
  ["system", "Prompt de sistema", ScrollText],
  ["tools", "Tools", Wrench],
  ["skills", "Skills", Sparkles],
  ["attachments", "Adjuntos", Paperclip],
  ["messages", "Mensajes", MessageSquare],
  ["toolResults", "Resultados de tools", FileOutput],
]

function Part({
  icon: Icon,
  k,
  n,
  of,
  dim,
}: {
  icon: LucideIcon
  k: string
  n: number
  of?: number
  dim?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-2", dim && "text-muted-foreground")}>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1">{k}</span>
      <span className="font-mono tabular-nums">
        {fmt(n)}
        {of ? (
          <span className="text-muted-foreground">
            {" "}
            {n / of < 0.01 ? "<1" : Math.round((n / of) * 100)}%
          </span>
        ) : null}
      </span>
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("font-mono tabular-nums", strong && "text-foreground")}>{v}</span>
    </div>
  )
}

// Anillo de ocupación de la ventana; el desglose solo en hover/foco. Ventana y precio son
// best-effort (`info` del proveedor): sin ventana el anillo va punteado, sin precio no hay $.
// Siempre visible: sin `meter` (chat nuevo o guardado antes de existir) va vacío, sin inventar 0%.
export function ContextRing({
  provider,
  modelId,
  meter,
}: {
  provider: ProviderConfig
  modelId: string
  meter: Meter | null
}) {
  const context = meter?.context ?? 0
  const info = provider.models.find((m) => m.id === modelId)?.info
  // Ollama: la ventana real (num_ctx) se relee tras cada turno; puede cambiar si se recarga.
  const [runtime, setRuntime] = useState<number>()
  useEffect(() => {
    let live = true
    ollamaWindow(provider, modelId).then((n) => live && setRuntime(n))
    return () => {
      live = false
    }
  }, [provider, modelId, meter])
  const size = runtime ?? info?.context
  const p = meter && size ? Math.min(1, context / size) : undefined
  const price = info?.price
  // Monocromo hasta que importa: warning ≥ 80%, destructive ≥ 95%.
  const tone = p == null || p < 0.8 ? "" : p < 0.95 ? "text-warning" : "text-destructive"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={p != null ? `Contexto ${Math.round(p * 100)}% usado` : "Uso de contexto"}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-pill text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
            tone,
          )}
        >
          <svg viewBox="0 0 20 20" className="size-4.5 -rotate-90">
            <circle
              cx="10"
              cy="10"
              r={R}
              fill="none"
              strokeWidth="2"
              className="stroke-foreground/15"
              strokeDasharray={size ? undefined : "2 3"}
            />
            {p != null && (
              <circle
                cx="10"
                cy="10"
                r={R}
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                stroke="currentColor"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - Math.max(p, 0.02))}
                className="transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
              />
            )}
          </svg>
        </span>
      </TooltipTrigger>
      {/* Superficie de popover, no la invertida del tooltip: es un panel de datos, no una etiqueta. */}
      <TooltipContent
        side="top"
        align="end"
        sideOffset={6}
        showArrow={false}
        className="block w-64 max-w-none rounded-xl bg-popover p-3 text-popover-foreground ring-1 ring-border"
      >
        <div className="flex items-baseline justify-between">
          <span className="text-sm">Contexto</span>
          <span className={cn("font-mono tabular-nums", tone)}>
            {p != null ? `${Math.round(p * 100)}%` : "—"}
          </span>
        </div>
        <div className="mt-1 font-mono text-muted-foreground tabular-nums">
          {meter
            ? `${fmt(context)}${size ? ` / ${fmt(size)} tokens` : " tokens · ventana desconocida"}`
            : size
              ? `Ventana de ${fmt(size)} tokens`
              : "Ventana desconocida"}
        </div>
        {!meter && (
          <p className="mt-2 text-muted-foreground">Se mide al enviar el próximo mensaje.</p>
        )}
        {/* Pasarse no tira error: el proveedor descarta el inicio del chat en silencio. */}
        {size != null && context > size && (
          <p className="mt-2 text-destructive">
            Te pasaste de la ventana: el modelo ya no ve el inicio del chat. Empezá un chat nuevo
            {provider.preset === "ollama" && " o subí el contexto en Ollama"}.
          </p>
        )}
        {meter && (
          <>
            <div className="mt-3 mb-1.5 text-muted-foreground">Tokens estimados por categoría</div>
            <div className="flex flex-col gap-1.5">
              {PARTS.map(
                ([k, label, icon]) =>
                  meter.parts[k] > 0 && (
                    <Part key={k} icon={icon} k={label} n={meter.parts[k]} of={size ?? context} />
                  ),
              )}
              {size != null && size > context && (
                <Part icon={SquareDashed} k="Libre" n={size - context} of={size} dim />
              )}
            </div>
          </>
        )}
        {(meter || price) && <div className="my-3 h-px bg-border" />}
        <div className="flex flex-col gap-1.5">
          {meter && (
            <>
              <Row k="Sesión · entrada" v={fmt(meter.session.input)} />
              <Row k="Sesión · salida" v={fmt(meter.session.output)} />
              {price && <Row k="Costo de la sesión" v={usd(cost(meter.session, price))} strong />}
              {price && <Row k="Último turno" v={usd(cost(meter.last, price))} />}
            </>
          )}
          {price && price[0] + price[1] > 0 && (
            <Row k="Precio por 1M" v={`$${+price[0].toFixed(2)} / $${+price[1].toFixed(2)}`} />
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
