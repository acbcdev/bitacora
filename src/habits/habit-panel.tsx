import { useState, useSyncExternalStore } from "react"
import type { ReactNode } from "react"
import { Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Minus, Plus } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Dropover, DropoverContent, DropoverTrigger } from "@/core/ui/dropover"
import { cn } from "@/core/lib/utils"
import { dayKey } from "@/core/lib/day"
import {
  SERIES,
  cellColor,
  dayAt,
  displayAmount,
  displayTarget,
  fromDisplay,
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

// Atajos: corregir casi siempre es decir el valor final ("fueron 20"), no llegar a golpes de +5.
// Cuartos de la meta + meta + 1.5×, redondeados al step, sin duplicados. En display units.
// ponytail: derivados de la meta; con metas chicas faltan intermedios (meta 3 → 0·1·2·3·5).
const presets = (metric: HabitMetric, target: number) => {
  const r = (x: number) => Math.round(x / STEP[metric]) * STEP[metric]
  return [
    ...new Set([0, r(target * 0.25), r(target * 0.5), r(target * 0.75), target, r(target * 1.5)]),
  ]
}

const FMT = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short" })
const FMT_DAY = new Intl.DateTimeFormat("es", { day: "numeric" })
const FMT_MONTH_SHORT = new Intl.DateTimeFormat("es", { month: "short" })
const FMT_MONTH = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" })

const PERIOD_NOUN: Record<HabitPeriod, string> = { day: "días", week: "semanas", month: "meses" }

// La serie de períodos, a lo GitHub. Sin clicks: es un resumen, no un control. Color por pct de
// la celda — la misma mezcla monocroma del dot (ADR 0023), cero = --track.
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
      {state.days.map((cell, n) => (
        <span
          key={n}
          style={{ backgroundColor: cellColor(habit.kind, cell, n === state.days.length - 1) }}
          className="h-7 flex-1 rounded-xs"
        />
      ))}
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
  const label = i === TODAY ? currentLabel : cellLabel
  const target = displayTarget(habit)

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
        className="flex flex-col gap-4 rounded-xl p-5 shadow-xl md:w-80 max-md:min-h-[50vh] max-md:rounded-t-xl max-md:px-5 max-md:pb-10 max-md:pt-3"
        // Foco al contenedor, no al primer botón: el `‹` auto-enfocado pintaba un ring de
        // focus-visible al abrir. Además deja ←/→ libres desde el primer frame.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).focus()
        }}
        // Teclas locales al panel (no hotkeys globales): solo valen con el foco adentro. En el
        // input, ←/→ mueven el cursor y ↑/↓ los resuelve el number nativo (step y min incluidos).
        onKeyDown={(e) => {
          if (e.target instanceof HTMLInputElement) {
            if (e.key === "Enter") {
              e.preventDefault()
              e.currentTarget.focus() // confirma y devuelve ←/→ a la navegación
            }
            return
          }
          const check = habit.metric === "check"
          const k = e.key
          if (k === "ArrowLeft" && i > 0) setI(i - 1)
          else if (k === "ArrowRight" && i < TODAY) setI(i + 1)
          else if (k === "ArrowUp") {
            if (check) write(1)
            else nudge(step)
          } else if (k === "ArrowDown") {
            if (check) write(0)
            else if (shown > 0) nudge(-Math.min(step, shown))
          } else return
          e.preventDefault()
        }}
      >
        {/* Qué + cuándo en una fila. Sin la meta: el `/20 min` ya la dice y el período lo dice el
            label. Label de ancho fijo → las flechas no se corren entre clicks repetidos. */}
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-base font-medium leading-none">{habit.name}</p>
          <div className="flex shrink-0 items-center text-sm">
            <NavBtn
              label="Período anterior"
              keys="ArrowLeft"
              disabled={i === 0}
              onClick={() => setI(i - 1)}
            >
              <ChevronLeft className="size-4" />
            </NavBtn>
            <span className="w-28 truncate text-center font-medium" title={label}>
              {label}
            </span>
            {/* No hay "siguiente" desde hoy: el futuro no se corrige. */}
            <NavBtn
              label="Período siguiente"
              keys="ArrowRight"
              disabled={i === TODAY}
              onClick={() => setI(i + 1)}
            >
              <ChevronRight className="size-4" />
            </NavBtn>
          </div>
        </div>

        {/* En un teléfono no hay hover: la historia sólo puede entrar acá. En desktop vive en el
            tile y meterla otra vez sería mostrarla dos veces a la vez. */}
        <div className="md:hidden rounded-xl bg-muted p-3">
          <HabitHistory habit={habit} state={state} />
        </div>

        {/* `check` no lleva stepper: con dos valores, un −/+ es un rodeo para decir sí o no. El
            toggle es el mismo ícono del hero del tile. */}
        {habit.metric === "check" ? (
          <button
            type="button"
            aria-pressed={shown > 0}
            onClick={() => write(shown > 0 ? 0 : 1)}
            className="flex flex-col items-center gap-2 rounded-xl py-2 outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.98]"
          >
            {shown > 0 ? (
              <Check className="size-12" strokeWidth={2} />
            ) : (
              <Circle
                className="size-12 text-muted-foreground"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            )}
            <span className="font-mono text-xs text-muted-foreground">
              {shown > 0 ? "hecho · tocá para deshacer" : "tocá para marcar"}
            </span>
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between pt-1">
              <RoundBtn
                label="Restar"
                disabled={shown === 0}
                onClick={() => nudge(-Math.min(step, shown))}
              >
                <Minus className="size-4" />
              </RoundBtn>
              {/* El número ES el input: click y tipeás (select-all al foco → reemplaza). */}
              <label className="flex items-baseline">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={step}
                  value={shown}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => write(Math.max(0, Number(e.target.value) || 0))}
                  aria-label={`Cantidad de ${label}`}
                  style={{ width: `${Math.max(1, String(shown).length) + 0.2}ch` }}
                  className="rounded-md bg-transparent text-center text-4xl font-normal tracking-tighter tabular-nums outline-none transition-colors [appearance:textfield] hover:bg-muted/60 focus:bg-muted [&::-webkit-inner-spin-button]:appearance-none"
                />
                <small className="ml-1 text-base text-muted-foreground">
                  /{target}
                  {habit.metric === "time" && " min"}
                </small>
              </label>
              <RoundBtn label="Sumar" onClick={() => nudge(step)}>
                <Plus className="size-4" />
              </RoundBtn>
            </div>

            <div className="h-1 overflow-hidden rounded-full bg-track">
              <div
                style={{ transform: `scaleX(${Math.min(1, shown / Math.max(target, 1))})` }}
                className="h-full origin-left rounded-full bg-foreground transition-transform duration-200 ease-out motion-reduce:transition-none"
              />
            </div>

            <div className="flex gap-1.5">
              {presets(habit.metric, target).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={shown === c}
                  onClick={() => write(c)}
                  className={cn(
                    "flex h-8 flex-1 items-center justify-center gap-0.5 rounded-md font-mono text-xs tabular-nums transition-[transform,background-color,color] duration-150 ease-out active:scale-95 max-md:h-10",
                    shown === c
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c}
                  {c === target && <Check className="size-3" strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          </>
        )}
      </DropoverContent>
    </Dropover>
  )
}

type BtnProps = {
  label: string
  keys?: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function NavBtn({ label, keys, ...p }: BtnProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-keyshortcuts={keys}
      title={keys && `${label} (${keys === "ArrowLeft" ? "←" : "→"})`}
      className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
      {...p}
    />
  )
}

function RoundBtn({ label, ...p }: BtnProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-11 items-center justify-center rounded-full bg-secondary transition-[transform,background-color] duration-150 ease-out hover:bg-muted active:scale-95 disabled:pointer-events-none disabled:opacity-30"
      {...p}
    />
  )
}
