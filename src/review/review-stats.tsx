import { useState } from "react"
import { Flame } from "lucide-react"
import { cn } from "@/core/lib/utils"
import { HISTORY_DAYS, type ComplianceDay } from "@/core/store/derive"

const DAY = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short" })

const pct = (p: number) => `${Math.round(p * 100)}%`
const isFull = (d: ComplianceDay) => d.total > 0 && d.met === d.total

// "hoy" para el último; el resto "mié 4 nov" (sin los puntos/comas de Intl).
function dayLabel(i: number, n: number) {
  if (i === n - 1) return "hoy"
  const d = new Date()
  d.setDate(d.getDate() - (n - 1 - i))
  return DAY.format(d).replace(/[.,]/g, "")
}

// Hover: el día bajo el cursor arriba y el resumen de la ventana abajo — todo derivado de `days`.
function Panel({ days, hovered }: { days: ComplianceDay[]; hovered: number }) {
  const d = days[hovered]
  const today = days.at(-1)
  const avg = days.reduce((a, x) => a + x.progress, 0) / days.length
  return (
    <div className="pointer-events-none absolute top-full right-0 z-10 mt-2.5 w-64 animate-in rounded-2xl border bg-popover p-3.5 text-popover-foreground shadow-lg duration-150 ease-out fade-in-0 zoom-in-95 slide-in-from-top-1">
      <div className="mb-2.5 flex justify-between border-b pb-2.5 text-xs">
        <span>{dayLabel(hovered, days.length)}</span>
        <span className="mono">
          <span className={cn(isFull(d) && "text-signal")}>
            {d.met}/{d.total}
          </span>{" "}
          · {pct(d.progress)}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {[
          [`${days.filter(isFull).length}`, `/${days.length}`, "días completos"],
          [pct(avg), "", "promedio"],
          [`${today?.met ?? 0}`, `/${today?.total ?? 0}`, "hoy"],
        ].map(([v, of, l]) => (
          <div key={l}>
            <dd className="mono text-base">
              {v}
              <small className="mono-dim">{of}</small>
            </dd>
            <dt className="text-2xs text-muted-foreground">{l}</dt>
          </div>
        ))}
      </dl>
    </div>
  )
}

// Cumplimiento diario (CONTEXT.md) en barras finas: altura = progress (piso 12%), verde SOLO si
// cumplió todos los diarios — hoy incluido. Hoy sin cumplir va en fg-secondary para marcarlo sin mentir verde;
// días parciales en muted (track sobre bg da 1.35:1, invisible).
// Cada barra vive en una columna de 7px (4 + 1.5 de cada lado = el gap de antes): hit-area entero, mismo dibujo.
function DailyBars({ days }: { days: ComplianceDay[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <span className="relative flex items-end" onMouseLeave={() => setHovered(null)}>
      <span
        role="img"
        aria-label={`Cumplimiento de hábitos, últimos ${HISTORY_DAYS} días: ${days.map((d) => `${Math.round(d.progress * 100)}%`).join(", ")}`}
        className="-mx-[1.5px] flex h-7 items-end"
      >
        {days.map((d, i) => (
          <span
            key={i}
            onMouseEnter={() => setHovered(i)}
            className="flex h-full items-end px-[1.5px]"
          >
            <span
              style={{ height: `${Math.max(d.progress * 100, 12)}%` }}
              className={cn(
                "w-1 rounded-xs transition-opacity duration-150 ease-out",
                isFull(d)
                  ? "bg-signal"
                  : i === days.length - 1
                    ? "bg-fg-secondary"
                    : "bg-muted-foreground",
                hovered !== null && hovered !== i && "opacity-35",
              )}
            />
          </span>
        ))}
      </span>
      {hovered !== null && <Panel days={days} hovered={hovered} />}
    </span>
  )
}

// Cabecera de la sección Repaso: mismo h2 que Hábitos/Notebooks + cumplimiento de hábitos.
// Lo de lectura (racha + meta) vive en la card, en ReadChip.
export function ReviewStats({ days }: { days: ComplianceDay[] }) {
  return (
    // pe = padding de la card: las barras terminan alineadas con el contenido de abajo.
    <div className="mb-4 flex items-end justify-between pe-5 sm:pe-10">
      <h2 className="text-xl font-semibold tracking-tight">Repaso</h2>
      <DailyBars days={days} />
    </div>
  )
}

// Racha + meta de lectura en una pastilla: el fondo se llena con la meta (proporcional, no un punto
// por nota — la meta es configurable sin máximo). Tinte = signal mezclado sobre muted: anda en
// light y dark sin token nuevo.
export function ReadChip({
  streak,
  readToday,
  goal,
}: {
  streak: number
  readToday: number
  goal: number
}) {
  const p = Math.min(100, (readToday / goal) * 100)
  return (
    <span
      className="relative isolate inline-flex h-7 items-center gap-2.5 overflow-hidden rounded-full bg-muted px-3"
      aria-label={`Racha de lectura: ${streak} días. Leídas hoy: ${readToday} de ${goal}`}
    >
      {/* Fill como span aparte: un gradient no interpola, width sí. */}
      <span
        style={{
          width: `${p}%`,
          background: "color-mix(in oklab, var(--signal) 18%, var(--muted))",
        }}
        className="absolute inset-y-0 left-0 -z-10 transition-[width] duration-500 ease-out motion-reduce:transition-none"
      />
      {/* Llama verde = racha viva (ADR 0023). Número verde = el día de hoy ya suma (meta cumplida). */}
      <span className="inline-flex items-center gap-1">
        <Flame size={13} className={streak > 0 ? "text-signal" : "text-muted-foreground"} />
        <span
          className={cn(
            "font-mono text-xs",
            readToday >= goal ? "text-signal" : "text-fg-secondary",
          )}
        >
          {streak}
        </span>
      </span>
      <span className="font-mono text-xs text-fg-secondary">
        {readToday}
        <span className="text-muted-foreground">/{goal} leídas</span>
      </span>
    </span>
  )
}
