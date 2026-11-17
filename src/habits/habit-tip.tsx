import type { HabitPeriod } from "@/core/types/database"

export type TipData = {
  label: string // "mié, 30 sept" / "Semana del 28 sept"
  amount: number
  target: number
  unit: string // " min" | ""
  before: boolean // antes de crear el hábito: sólo la fecha
  period: HabitPeriod
  day?: { label: string; amount: number } // sólo semana/mes: el aporte del día
}

// Posición + clamp a los bordes del contenedor.
export function HabitTip({ x, y, tip }: { x: number; y: number; tip: TipData }) {
  return (
    <span
      ref={(el) => {
        if (!el?.parentElement) return
        const half = el.offsetWidth / 2
        el.style.left = `${Math.min(Math.max(x, half), el.parentElement.offsetWidth - half)}px`
      }}
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
      style={{ top: y - 6 }}
    >
      <span className="flex origin-bottom animate-in flex-col gap-0.5 rounded-lg bg-foreground px-3 py-2 whitespace-nowrap text-background shadow-md duration-150 ease-out fade-in-0 zoom-in-95 motion-reduce:animate-none">
        <span className="font-mono text-2xs tracking-wide uppercase opacity-60">{tip.label}</span>
        {!tip.before && (
          <span className="font-mono text-md leading-none font-medium tabular-nums">
            {tip.amount}
            <span className="opacity-50">
              /{tip.target}
              {tip.unit}
            </span>
          </span>
        )}
        {tip.day?.amount ? (
          <span className="font-mono text-2xs opacity-60">
            {tip.day.label} · +{tip.day.amount}
            {tip.unit}
          </span>
        ) : null}
      </span>
    </span>
  )
}
