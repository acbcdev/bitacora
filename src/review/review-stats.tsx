import { Flame } from "lucide-react"
import { cn } from "@/core/lib/utils"
import { HISTORY_DAYS, type ComplianceDay } from "@/core/store/derive"

const DATE = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" })

// Cumplimiento diario (CONTEXT.md) en barras finas: altura = progress (piso 12%), verde SOLO si
// cumplió todos los diarios — hoy incluido. Hoy sin cumplir va en fg-secondary para marcarlo sin mentir verde;
// días parciales en muted (track sobre bg da 1.35:1, invisible).
function DailyBars({ days }: { days: ComplianceDay[] }) {
  return (
    <span
      role="img"
      aria-label={`Cumplimiento de hábitos, últimos ${HISTORY_DAYS} días: ${days.map((d) => `${Math.round(d.progress * 100)}%`).join(", ")}`}
      className="flex h-7 items-end gap-[3px]"
    >
      {days.map(({ met, total, progress }, i) => (
        <span
          key={i}
          style={{ height: `${Math.max(progress * 100, 12)}%` }}
          className={cn(
            "w-1 rounded-xs",
            total > 0 && met === total
              ? "bg-signal"
              : i === days.length - 1
                ? "bg-fg-secondary"
                : "bg-muted-foreground",
          )}
        />
      ))}
    </span>
  )
}

// Cabecera de la pantalla Hoy: fecha, racha de lectura, cumplimiento de hábitos y meta del día.
export function ReviewStats({
  streak,
  readToday,
  goal,
  days,
}: {
  streak: number
  readToday: number
  goal?: number
  days: ComplianceDay[]
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <p className="eyebrow">Hoy · {DATE.format(new Date()).replace(",", "")}</p>
      <div className="flex items-center gap-6">
        <span className="inline-flex items-center gap-1.5">
          <Flame size={14} className={streak > 0 ? "text-signal" : "text-muted-foreground"} />
          <span className="mono">
            {streak} {streak === 1 ? "día" : "días"}
          </span>
        </span>
        <span className="flex items-end gap-2">
          <DailyBars days={days} />
          <small className="mono-dim text-[11px]">{HISTORY_DAYS} días</small>
        </span>
        <span className="mono">
          leídas hoy {readToday}
          {goal && `/${goal}`}
        </span>
      </div>
    </div>
  )
}
