import { useState, useSyncExternalStore } from "react"
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
import {
  SERIES,
  cellColor,
  cellPct,
  dayAt,
  displayAmount,
  fromDisplay,
  goalText,
  parseDay,
  periodKey,
  periodStartAt,
  type HabitState,
} from "@/habits/habits"
import { useHabitLog, useSetDay } from "@/habits/habits.api"
import type { Habit, HabitMetric, HabitPeriod } from "@/core/types/database"

// Dos gestos distintos, dos superficies distintas:
//  · MIRAR la serie   → hover/historia (HabitHistory, sólo lectura), en la escala del período
//    del hábito (ADR 0013).
//  · CORREGIR         → el `⌄` (HabitPanel). En `day` corrige un día (una fila por día, ADR 0009);
//    en semana/mes corrige el TOTAL del período — nunca reparte en días: consolida todo el valor
//    en UNA fila del período (el modelo "una fila = el total" ya lo puntuaba bien la derivación).
// Estaban juntos y por eso el popover tenía cuatro bloques y tres formas de escribir el mismo
// número. La grilla clickeable era lo único que obligaba a un Dropover en vez de un Tooltip; ahora
// que es de sólo lectura, el hover puede ser un Tooltip pelado.

// Un sólo panel abierto a la vez: cada tile montaba su propio `open` y en mobile los drawers se
// apilaban. El estado global vive en el módulo — el subscribe re-renderiza los HabitPanel montados
// (son pocos) y abrir otro cierra el anterior sin prop-drilling por tres niveles.
let openHabitId: string | null = null
const panelSubs = new Set<() => void>()
const setOpenHabit = (id: string | null) => {
  openHabitId = id
  for (const l of panelSubs) l()
}
function useOpenHabit() {
  return [
    useSyncExternalStore(
      (l) => (panelSubs.add(l), () => panelSubs.delete(l)),
      () => openHabitId,
    ),
    setOpenHabit,
  ] as const
}

// Cuánto mueve el `+`. En `time` de a 5: nadie corrige minutos de a uno.
// El STEP sigue en minutos de display; toStorage lo pasa a segundos.
const STEP: Record<HabitMetric, number> = { check: 1, count: 1, time: 5 }

const FMT = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short" })
const FMT_DAY = new Intl.DateTimeFormat("es", { day: "numeric" })
const FMT_MONTH_SHORT = new Intl.DateTimeFormat("es", { month: "short" })
const FMT_MONTH = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" })

const PERIOD_NOUN: Record<HabitPeriod, string> = { day: "días", week: "semanas", month: "meses" }

// La serie de períodos, a lo GitHub. Sin clicks: es un resumen, no un control. Color por pct de
// la celda — la misma mezcla del dot y la barra del tile (ADR 0013), cero = rojo pleno.
export function HabitHistory({ habit, state }: { habit: Habit; state: HabitState }) {
  return (
    <div
      role="img"
      aria-label={`${habit.period === "week" ? "Últimas" : "Últimos"} ${state.days.length} ${PERIOD_NOUN[habit.period]} de ${habit.name}: ${state.days
        .map((c) => c.amount)
        .join(", ")}`}
      // Días: gap más chico → cada celda un pelín más ancha (7 celdas vs 4-5 de semana/mes).
      className={habit.period === "day" ? "flex w-full gap-[2px]" : "flex w-full gap-1"}
    >
      {state.days.map((cell, n) =>
        // Hoy sin resaltado; gris mientras está vacío, color al registrar — igual que los dots.
        n === state.days.length - 1 && cell.amount === 0 ? (
          <span key={n} className="h-7 flex-1 rounded-[3px] bg-muted" />
        ) : (
          <span
            key={n}
            style={{ backgroundColor: cellColor(habit.kind, cellPct(cell)) }}
            className="h-7 flex-1 rounded-[3px]"
          />
        ),
      )}
    </div>
  )
}

export function HabitPanel({ habit, state }: { habit: Habit; state: HabitState }) {
  const setDay = useSetDay()
  const { data: log = [] } = useHabitLog()
  const [openId, setOpenId] = useOpenHabit()
  const open = openId === habit.id
  // Qué período se está corrigiendo: el último de la serie es el en curso. Sin grilla, se navega
  // con las flechas.
  const TODAY = SERIES[habit.period] - 1
  const [i, setI] = useState(TODAY)

  const isDay = habit.period === "day"
  const day = dayAt(i)
  const periodStart = periodStartAt(i, habit.period)
  // El número sale del cache, no de un borrador: MISMA fuente que el tile, así que el cronómetro
  // o un h>N con el panel abierto se ven acá al toque.
  // Para time, amount viene en segundos (0011) — en el panel se muestra en min.
  const rawShown = state.days[i].amount
  const shown = displayAmount(habit, rawShown)
  const step = STEP[habit.metric]
  const toStorage = (v: number) => fromDisplay(habit.metric, v)

  // Etiqueta de la celda: día tal cual; semana como rango numérico "14 – 20 sept" (el mes una
  // sola vez, dos si cruza de mes) — sin días de semana ni meses repetidos; mes con nombre y año.
  const cellLabel = isDay
    ? FMT.format(day)
    : habit.period === "week"
      ? (() => {
          const end = new Date(periodStart)
          end.setDate(end.getDate() + 6)
          const m1 = FMT_MONTH_SHORT.format(periodStart)
          const m2 = FMT_MONTH_SHORT.format(end)
          return m1 === m2
            ? `${FMT_DAY.format(periodStart)} – ${FMT_DAY.format(end)} ${m1}`
            : `${FMT_DAY.format(periodStart)} ${m1} – ${FMT_DAY.format(end)} ${m2}`
        })()
      : FMT_MONTH.format(periodStart)
  const currentLabel = { day: "hoy", week: "esta semana", month: "este mes" }[habit.period]

  // Cada gesto escribe, igual que el click del tile — la mutation es optimista, el número se mueve
  // sin esperar el round-trip. Antes esto juntaba los cambios en un borrador y los volcaba al
  // cerrar, y por eso hacía falta un cartel ("Se guarda al cerrar. Sin guardar todavía.") que sólo
  // existía para explicar su propia mecánica. Sin borrador no hay nada pendiente que avisar.
  // ponytail: un upsert por tap del `+`. Es lo que ya hace el tile; si el spam molesta, debounce
  // acá — no volver al borrador.
  // La fila que representa al período: hoy si es el período en curso (misma fila que mueve el
  // botón + del tile), si no el día de arranque (lunes / día 1).
  const repDay = i === TODAY ? dayKey(new Date()) : dayKey(periodStart)

  const write = (value: number) => {
    if (isDay) return setDay.mutate({ habit, day: dayKey(day), value: toStorage(value) })
    // Período: el SET es sobre el TOTAL, no sobre una fila. Consolida en UNA fila — la
    // representativa — y cero las demás filas del período. Nunca reparte en días: eso es
    // lo que ADR 0009 mató.
    const key = periodKey(periodStart, habit.period)
    const rows = log.filter(
      (r) => r.habit_id === habit.id && periodKey(parseDay(r.day), habit.period) === key,
    )
    for (const r of rows) {
      if (r.day !== repDay && r.amount !== 0) setDay.mutate({ habit, day: r.day, value: 0 })
    }
    setDay.mutate({ habit, day: repDay, value: toStorage(Math.max(0, value)) })
  }
  // +/− relativos al cache (mismo onMutate que el tile): taps rápidos del stepper no se pisan
  // aunque la render esté vieja. En los tres períodos es delta sobre la fila representativa —
  // que en semana/mes suma exactamente n al total del período.
  const nudge = (n: number) =>
    isDay
      ? setDay.mutate({ habit, day: dayKey(day), delta: toStorage(n) })
      : setDay.mutate({ habit, day: repDay, delta: toStorage(n) })

  return (
    <Dropover
      open={open}
      onOpenChange={(next) => {
        setOpenId(next ? habit.id : null)
        setI(TODAY) // abrir y cerrar siempre vuelven al período en curso: el panel corrige, no navega
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
        className="flex flex-col gap-5 rounded-2xl p-5 shadow-xl md:w-92 md:gap-5 md:p-6 max-md:min-h-[60vh] max-md:rounded-t-[20px] max-md:px-5 max-md:pb-10 max-md:pt-3"
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
            aria-label="Período anterior"
            disabled={i === 0}
            onClick={() => setI(i - 1)}
            className="size-10 shrink-0 md:size-10 max-md:size-11"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="flex-1 text-center">
            <span className="block text-[15px] font-semibold tracking-tight leading-none">
              {i === TODAY ? currentLabel : cellLabel}
            </span>
            {i !== TODAY && isDay && (
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
            aria-label="Período siguiente"
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
          <InputGroup className="h-15 w-full rounded-2xl border bg-card shadow-sm md:mx-auto md:h-14 md:max-w-[260px] max-md:h-[64px]">
            <InputGroupAddon align="inline-start" className="pl-1.5">
              <InputGroupButton
                size="icon-sm"
                aria-label="Restar"
                disabled={shown === 0}
                onClick={() => nudge(-step)}
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
              aria-label={`Cantidad de ${cellLabel}`}
              className="text-center text-xl font-semibold tabular-nums tracking-tight md:text-lg max-md:text-xl"
            />
            <InputGroupAddon align="inline-end" className="pr-1.5">
              <InputGroupButton
                size="icon-sm"
                variant="ghost"
                aria-label="Sumar"
                onClick={() => nudge(step)}
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
