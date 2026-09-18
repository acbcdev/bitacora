import { Flame } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { todayKey } from "@/core/lib/day"
import { cn } from "@/core/lib/utils"
import { DAILY_GOAL, HISTORY_DAYS, lastDays } from "@/core/store/derive"

// Los últimos 14 días de lectura, a lo GitHub. Sin clicks: es un resumen, no un control.
// El color sale de la fracción leída contra la meta del día, no de un sí/no: 1 de 3 notas no es
// lo mismo que 3 de 3. Mezcla contra --muted (no transparent) para que la escala no se dé vuelta
// entre tema claro y oscuro. Piso de 25%: "leí algo" nunca se ve igual que "no leí nada".
function ReadHistory({ byDay }: { byDay?: Map<string, number> }) {
  const days = lastDays(byDay)
  return (
    <span
      role="img"
      aria-label={`Últimos ${HISTORY_DAYS} días de lectura: ${days.join(", ")}`}
      className="flex gap-1"
    >
      {days.map((n, i) => (
        <span
          key={i}
          style={
            n === 0
              ? undefined
              : {
                  backgroundColor: `color-mix(in oklab, var(--brand) ${Math.round(25 + Math.min(1, n / DAILY_GOAL) * 75)}%, var(--muted))`,
                }
          }
          className={cn(
            "h-7 w-3.5 rounded-[3px]",
            n === 0 && "bg-muted",
            i === HISTORY_DAYS - 1 && "ring-1 ring-border ring-offset-1 ring-offset-popover",
          )}
        />
      ))}
    </span>
  )
}

// Cabecera de la pantalla Hoy: racha con historial (tooltip) y meta del día. Antes inline en
// review.tsx; mismo JSX, extraído tal cual.
export function ReviewStats({
  streak,
  readToday,
  byDay,
}: {
  streak: number
  readToday: number
  byDay?: Map<string, number>
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <p className="eyebrow">Hoy — {todayKey()}</p>
      <div className="flex items-center gap-6">
        {/* Hover = MIRAR el historial, igual que el tile de hábito. Sin `asChild`: el trigger
            de Radix ya es un botón, así que el 🔥 se enfoca con Tab sin inventar tabIndex.
            `delayDuration` propio — el provider de app.tsx está en 0 y la grilla saltando al
            primer píxel de hover es ruido. */}
        <Tooltip delayDuration={400}>
          <TooltipTrigger className="inline-flex cursor-default items-center gap-1.5 rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Flame size={14} className="text-brand-fg" />
            <span className="mono">
              {streak} {streak === 1 ? "día" : "días"}
            </span>
          </TooltipTrigger>
          {/* Superficie de popover y sin flecha: adentro van cuadrados de color que sobre el
              fondo invertido del tooltip se leerían al revés (mismo motivo que HabitHistory). */}
          <TooltipContent
            side="bottom"
            sideOffset={6}
            showArrow={false}
            className="flex-col items-stretch gap-2 rounded-lg border bg-popover p-2.5 text-popover-foreground"
          >
            <span className="mono-dim text-[11px]">
              Últimos {HISTORY_DAYS} días · meta {DAILY_GOAL}/día
            </span>
            <ReadHistory byDay={byDay} />
          </TooltipContent>
        </Tooltip>
        <span className="mono">
          leídas hoy {readToday}/{DAILY_GOAL}
        </span>
      </div>
    </div>
  )
}
