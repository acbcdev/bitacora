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
import { dayKey } from "@/core/lib/stats"
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
            n === TODAY && "ring-1 ring-border ring-offset-1 ring-offset-popover",
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
  // Borrador, y SÓLO mientras editás: `null` significa "no tocaste nada", y entonces no se escribe
  // nada. Eso es lo que evita el bug del panel viejo, que guardaba una copia hecha al abrir y al
  // cerrar la pisaba encima de lo que hubiera escrito el tile, el atajo h>N o el cronómetro.
  const [draft, setDraft] = useState<number | null>(null)

  const day = dayAt(i)
  const shown = draft ?? state.days[i].amount
  const step = STEP[habit.metric]

  // Se escribe al SALIR del día: al cerrar el panel y al cambiar de fecha. Sin `Guardar` (el click
  // del tile tampoco pide confirmar) y sin un upsert por cada tap del `+`.
  function commit() {
    if (draft === null) return
    setDay.mutate({ habit, day: dayKey(day), value: draft })
    setDraft(null)
  }

  return (
    <Dropover
      open={open}
      onOpenChange={(next) => {
        if (!next) commit()
        setOpen(next)
        setI(TODAY) // abrir y cerrar siempre vuelven a hoy: el panel corrige, no navega
        setDraft(null)
      }}
    >
      <DropoverTrigger asChild>
        <button
          type="button"
          aria-label={`Corregir ${habit.name}`}
          // Nunca se desmonta (ni siquiera con el cronómetro corriendo): sacarlo encogería el tile
          // justo al arrancar el timer.
          // Se esconde al hover SÓLO de `md` para arriba: en Tailwind v4 `hover:` vive adentro de
          // `@media (hover: hover)`, así que en un celular un `opacity-0 group-hover:opacity-100`
          // no se pinta NUNCA — y este botón es el único acceso a corregir desde el teléfono.
          className="relative cursor-pointer rounded-full p-0.5 text-muted-foreground opacity-100 transition-opacity hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <ChevronDown size={14} />
        </button>
      </DropoverTrigger>

      <DropoverContent
        title={habit.name}
        className="flex flex-col gap-3 max-md:px-4 max-md:pb-8 md:w-72"
      >
        <p className="eyebrow">
          {habit.name} · {goalText(habit)}
        </p>

        {/* En un teléfono no hay hover: la historia sólo puede entrar acá. En desktop vive en el
            tile y meterla otra vez sería mostrarla dos veces a la vez. */}
        <div className="md:hidden">
          <HabitHistory habit={habit} state={state} />
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Día anterior"
            disabled={i === 0}
            onClick={() => {
              commit() // lo editado es del día que estás dejando, no del que viene
              setI(i - 1)
            }}
          >
            <ChevronLeft />
          </Button>
          <span className="flex-1 text-center text-sm">
            {i === TODAY ? "hoy" : FMT.format(day)}
          </span>
          {/* No hay "siguiente" desde hoy: el futuro no se corrige. */}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Día siguiente"
            disabled={i === TODAY}
            onClick={() => {
              commit()
              setI(i + 1)
            }}
          >
            <ChevronRight />
          </Button>
        </div>

        {/* Un solo control por métrica. `check` no lleva stepper: con dos valores posibles, un
            −/+ es un rodeo para decir sí o no. */}
        {habit.metric === "check" ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant={shown ? "outline" : "default"}
              className="flex-1"
              onClick={() => setDraft(0)}
            >
              No lo hice
            </Button>
            <Button
              type="button"
              variant={shown ? "default" : "outline"}
              className="flex-1"
              onClick={() => setDraft(1)}
            >
              Hecho
            </Button>
          </div>
        ) : (
          // Un solo control, no tres cajas sueltas: −, número y + comparten borde y foco. El
          // InputGroup ya lo resuelve, y el `−` se apaga en 0 porque no hay valores negativos.
          <InputGroup className="h-10">
            <InputGroupAddon align="inline-start">
              <InputGroupButton
                size="icon-sm"
                aria-label="Restar"
                disabled={shown === 0}
                onClick={() => setDraft(Math.max(0, shown - step))}
              >
                <Minus />
              </InputGroupButton>
            </InputGroupAddon>
            <InputGroupInput
              type="number"
              min={0}
              value={shown}
              onChange={(e) => setDraft(Math.max(0, Number(e.target.value) || 0))}
              aria-label={`Cantidad de ${FMT.format(day)}`}
              className="text-center text-base tabular-nums"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                aria-label="Sumar"
                onClick={() => setDraft(shown + step)}
              >
                <Plus />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}

        {/* Sin botón de guardar hay que decirlo: si no, se busca uno y se cierra creyendo que se
            perdió. */}
        <p className="text-xs text-muted-foreground">
          {draft === null ? "Se guarda al cerrar." : "Se guarda al cerrar. Sin guardar todavía."}
        </p>
      </DropoverContent>
    </Dropover>
  )
}
