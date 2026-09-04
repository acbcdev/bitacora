import { useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Dropover, DropoverContent, DropoverTrigger } from "@/core/ui/dropover"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/core/ui/input-group"
import { dayKey } from "@/core/lib/day"
import { cn } from "@/core/lib/utils"
import { dayAt, goalText, TRACKED_DAYS, type DayCell, type HabitState } from "@/habits/habits"
import { useSetDay } from "@/habits/habits.api"
import type { Habit, HabitMetric } from "@/core/types/database"

// Dos gestos distintos, dos superficies distintas:
//  · MIRAR los 14 días → hover del tile (HabitHistory, sólo lectura).
//  · CORREGIR un día   → el `⌄` (HabitPanel).
// Estaban juntos y por eso el popover tenía cuatro bloques y tres formas de escribir el mismo
// número. La grilla clickeable era lo único que obligaba a un Dropover en vez de un Tooltip; ahora
// que es de sólo lectura, el hover puede ser un Tooltip pelado.

const TODAY = TRACKED_DAYS - 1

// Cuánto mueve el `+`. En `time` de a 5: nadie corrige minutos de a uno.
// El STEP sigue en minutos de display; toStorage lo pasa a segundos.
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

// Los 14 días, a lo GitHub. Sin clicks: es un resumen, no un control.
export function HabitHistory({ habit, state }: { habit: Habit; state: HabitState }) {
  return (
    <div
      role="img"
      aria-label={`Últimos ${TRACKED_DAYS} días de ${habit.name}: ${state.days
        .map((c) => c.amount)
        .join(", ")}`}
      className="flex gap-1"
    >
      {state.days.map((cell, n) => (
        <span
          key={n}
          style={{ backgroundColor: dayColor(habit, cell) }}
          className={cn(
            "h-7 w-3.5 rounded-[3px]",
            // Sólo el día en cero usa clase: al resto lo pinta color-mix por fracción. En un
            // `bad` la escala va al revés — el día limpio es el verde.
            cell.amount === 0 && (habit.kind === "good" ? "bg-muted" : "bg-brand/40"),
            n === TODAY && "ring-2 ring-brand ring-offset-2 ring-offset-background",
          )}
        />
      ))}
    </div>
  )
}

export function HabitPanel({ habit, state }: { habit: Habit; state: HabitState }) {
  const setDay = useSetDay()
  const [open, setOpen] = useState(false)
  // Qué día se está corrigiendo: 13 = hoy. Sin grilla, se navega con las flechas.
  const [i, setI] = useState(TODAY)

  const day = dayAt(i)
  // El número sale del cache, no de un borrador: MISMA fuente que el tile, así que el cronómetro
  // o un h>N con el panel abierto se ven acá al toque.
  // Para time, amount viene en segundos (0011) — en el panel se muestra en min.
  const rawShown = state.days[i].amount
  const shown = habit.metric === "time" ? Math.floor(rawShown / 60) : rawShown
  const step = STEP[habit.metric]
  const toStorage = (v: number) => (habit.metric === "time" ? v * 60 : v)

  // Cada gesto escribe, igual que el click del tile — la mutation es optimista, el número se mueve
  // sin esperar el round-trip. Antes esto juntaba los cambios en un borrador y los volcaba al
  // cerrar, y por eso hacía falta un cartel ("Se guarda al cerrar. Sin guardar todavía.") que sólo
  // existía para explicar su propia mecánica. Sin borrador no hay nada pendiente que avisar.
  // ponytail: un upsert por tap del `+`. Es lo que ya hace el tile; si el spam molesta, debounce
  // acá — no volver al borrador.
  const write = (value: number) =>
    setDay.mutate({ habit, day: dayKey(day), value: toStorage(value) })

  return (
    <Dropover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setI(TODAY) // abrir y cerrar siempre vuelven a hoy: el panel corrige, no navega
      }}
    >
      <DropoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Corregir ${habit.name}`}
          // Nunca se desmonta (ni siquiera con el cronómetro corriendo): sacarlo encogería el tile
          // justo al arrancar el timer.
          // Se esconde al hover SÓLO de `md` para arriba: en Tailwind v4 `hover:` vive adentro de
          // `@media (hover: hover)`, así que en un celular un `opacity-0 group-hover:opacity-100`
          // no se pinta NUNCA — y este botón es el único acceso a corregir desde el teléfono
          // (el click en ícono/nombre dispara la acción rápida, no el panel).
          className="relative opacity-100 transition-opacity focus-visible:opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <ChevronDown className="size-3.5" />
        </Button>
      </DropoverTrigger>

      <DropoverContent
        title={habit.name}
        className="flex flex-col gap-5 rounded-2xl p-5 shadow-xl md:w-[368px] md:gap-5 md:p-6 max-md:rounded-t-[20px] max-md:px-5 max-md:pb-10 max-md:pt-3"
      >
        <p className="eyebrow leading-none">
          {habit.name} · {goalText(habit)}
        </p>

        {/* En un teléfono no hay hover: la historia sólo puede entrar acá. En desktop vive en el
            tile y meterla otra vez sería mostrarla dos veces a la vez. */}
        <div className="md:hidden rounded-xl bg-muted p-3">
          <HabitHistory habit={habit} state={state} />
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-muted p-1.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Día anterior"
            disabled={i === 0}
            onClick={() => setI(i - 1)}
            className="size-10 shrink-0 md:size-10 max-md:size-11"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="flex-1 text-center">
            <span className="block text-[15px] font-semibold tracking-tight leading-none">
              {i === TODAY ? "hoy" : FMT.format(day)}
            </span>
            {i !== TODAY && (
              <span className="block text-[11px] font-normal text-muted-foreground leading-none mt-0.5">
                {dayKey(day)}
              </span>
            )}
          </span>
          {/* No hay "siguiente" desde hoy: el futuro no se corrige. */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Día siguiente"
            disabled={i === TODAY}
            onClick={() => setI(i + 1)}
            className="size-10 shrink-0 md:size-10 max-md:size-11"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Un solo control por métrica. `check` no lleva stepper: con dos valores posibles, un
            −/+ es un rodeo para decir sí o no. */}
        {habit.metric === "check" ? (
          <div className="flex gap-3">
            <Button
              type="button"
              variant={shown ? "outline" : "default"}
              className="h-12 flex-1 rounded-xl text-sm font-medium md:h-11 max-md:h-12"
              onClick={() => write(0)}
            >
              No lo hice
            </Button>
            <Button
              type="button"
              variant={shown ? "default" : "outline"}
              className="h-12 flex-1 rounded-xl text-sm font-medium md:h-11 max-md:h-12"
              onClick={() => write(1)}
            >
              Hecho
            </Button>
          </div>
        ) : (
          // Ghost del DS: el InputGroup ya pone el borde exterior — un border propio por botón
          // duplicaba la línea. Compact en desk (max-w 260 centrado), más alto en mobile para thumb.
          <InputGroup className="h-[60px] w-full rounded-2xl border bg-card shadow-sm md:mx-auto md:h-14 md:max-w-[260px] max-md:h-[64px]">
            <InputGroupAddon align="inline-start" className="pl-1.5">
              <InputGroupButton
                size="icon-sm"
                aria-label="Restar"
                disabled={shown === 0}
                onClick={() => write(Math.max(0, shown - step))}
                className="size-11 md:size-10 max-md:size-11"
              >
                <Minus className="size-5" />
              </InputGroupButton>
            </InputGroupAddon>
            <InputGroupInput
              type="number"
              min={0}
              value={shown}
              onChange={(e) => write(Math.max(0, Number(e.target.value) || 0))}
              aria-label={`Cantidad de ${FMT.format(day)}`}
              className="text-center text-xl font-semibold tabular-nums tracking-tight md:text-lg max-md:text-xl"
            />
            <InputGroupAddon align="inline-end" className="pr-1.5">
              <InputGroupButton
                size="icon-sm"
                variant="ghost"
                aria-label="Sumar"
                onClick={() => write(shown + step)}
                className="size-11 md:size-10 max-md:size-11"
              >
                <Plus className="size-5" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}
      </DropoverContent>
    </Dropover>
  )
}
