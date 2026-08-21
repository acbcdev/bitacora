import { useState } from "react"
import { ChevronDown, Minus, Plus } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Dropover, DropoverContent, DropoverTrigger } from "@/core/ui/dropover"
import { dayKey } from "@/core/lib/stats"
import { cn } from "@/core/lib/utils"
import {
  dayAt,
  daysText,
  goalText,
  TRACKED_DAYS,
  unit,
  type DayCell,
  type HabitState,
} from "@/habits/habits"
import { useSetDay } from "@/habits/habits.api"
import type { Habit, HabitMetric } from "@/core/types/database"

// El panel del `⌄`: la meta, los últimos 14 días y el stepper del día que estés editando.
// Va en un Dropover (Popover en desktop, Drawer en mobile) y no en un Tooltip: un tooltip de Radix
// se cierra en pointer-down y su contenido no es focusable, así que no se podría clickear un
// cuadrado — y en mobile no hay hover, que es justo donde ADR 0004 dice que se repasa.

const TODAY = TRACKED_DAYS - 1

// El 0 va primero a propósito: "no lo hice" es la corrección más común.
const PRESETS: Record<HabitMetric, number[]> = {
  check: [0, 1],
  count: [0, 1, 2, 3, 5],
  time: [0, 10, 25, 45, 60],
}
const STEP: Record<HabitMetric, number> = { check: 1, count: 1, time: 5 }

const FMT = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short" })

// Un día no es sí/no: el color sale de la fracción hecha. Meta 25 min y 10 hechos = verde flojo.
// El target sale de LA CELDA (el congelado de esa fila), no de habits.target: un día viejo se
// pinta contra la meta que regía entonces (ADR 0009).
// ponytail: mezclar contra --muted (no transparent) hace que la escala se dé vuelta sola entre
// tema claro y oscuro, sin una paleta por tema. El piso de 25% existe para que "hice algo" nunca
// se vea igual que "no hice nada".
function dayColor(h: Habit, cell: DayCell) {
  if (cell.amount === 0) return undefined // el cero es el paso más apagado, lo pone la clase
  const perDay =
    h.period === "day" ? cell.target : h.period === "week" ? cell.target / 7 : cell.target / 30
  const ratio = Math.min(1, cell.amount / Math.max(perDay, 1))
  const color = h.kind === "good" ? "var(--brand)" : "var(--destructive)"
  return `color-mix(in oklab, ${color} ${Math.round(25 + ratio * 75)}%, var(--muted))`
}

export function HabitPanel({ habit, state }: { habit: Habit; state: HabitState }) {
  const setDay = useSetDay()
  const [open, setOpen] = useState(false)
  // Qué día se está editando: 13 = hoy. Click en un cuadrado lo cambia.
  const [i, setI] = useState(TODAY)
  const [value, setValue] = useState(state.days[TODAY].amount)

  function select(n: number) {
    setI(n)
    setValue(state.days[n].amount)
  }

  const step = STEP[habit.metric]
  const day = dayAt(i)

  return (
    <Dropover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        select(TODAY) // abrir y cerrar siempre vuelven a hoy: el panel corrige, no navega
      }}
    >
      <DropoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ver y corregir ${habit.name}`}
          // Nunca se desmonta (ni siquiera con el cronómetro corriendo): sacarlo encogería el tile
          // justo al arrancar el timer.
          // Se esconde al hover SÓLO de `md` para arriba: en Tailwind v4 `hover:` vive adentro de
          // `@media (hover: hover)`, así que en un celular un `opacity-0 group-hover:opacity-100`
          // no se pinta NUNCA — y este botón es el único acceso a los 14 días desde el teléfono,
          // que es donde ADR 0004 dice que se repasa.
          className="relative cursor-pointer rounded-full p-0.5 text-muted-foreground opacity-100 transition-opacity hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <ChevronDown size={14} />
        </button>
      </DropoverTrigger>

      <DropoverContent
        title={habit.name}
        className="flex flex-col gap-3 max-md:px-4 max-md:pb-8 md:w-80"
      >
        <p className="eyebrow">
          {habit.name} · {goalText(habit)}
          {habit.days?.length ? ` · ${daysText(habit)}` : ""}
        </p>

        <div className="flex gap-1">
          {state.days.map((cell, n) => (
            <button
              key={n}
              type="button"
              onClick={() => select(n)}
              aria-label={`${FMT.format(dayAt(n))}: ${cell.amount}${unit(habit)}`}
              aria-pressed={n === i}
              style={{ backgroundColor: dayColor(habit, cell) }}
              className={cn(
                "h-7 flex-1 cursor-pointer rounded-[3px]",
                // Sólo el día en cero usa clase: al resto lo pinta color-mix por fracción. En un
                // `bad` la escala va al revés — el día limpio es el verde.
                cell.amount === 0 && (habit.kind === "good" ? "bg-muted" : "bg-brand/40"),
                n === i && "ring-2 ring-ring ring-offset-1 ring-offset-popover",
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">{FMT.format(day)}</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Restar"
              onClick={() => setValue((v) => Math.max(0, v - step))}
            >
              <Minus />
            </Button>
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(Math.max(0, Number(e.target.value) || 0))}
              aria-label={`Cantidad de ${FMT.format(day)}`}
              className="h-8 w-16 rounded-md border bg-background px-2 text-center tabular-nums"
            />
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Sumar"
              onClick={() => setValue((v) => v + step)}
            >
              <Plus />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS[habit.metric].map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={p === value ? "default" : "outline"}
              onClick={() => setValue(p)}
            >
              {p}
              {unit(habit)}
            </Button>
          ))}
          {/* Un upsert, el mismo que el click del tile. Un día pasado sin fila se congela con el
              target actual del hábito (habits.api.ts): nadie sabe cuál regía entonces. */}
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setDay.mutate({ habit, day: dayKey(day), value })
              setOpen(false)
            }}
          >
            Guardar
          </Button>
        </div>
      </DropoverContent>
    </Dropover>
  )
}
