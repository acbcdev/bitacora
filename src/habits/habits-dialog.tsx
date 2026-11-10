import { useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
  Archive,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  Flame,
  Hash,
  Plus,
  Target,
} from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { Button } from "@/core/ui/button"
import { Drialog, DrialogContent, DrialogTitle } from "@/core/ui/drialog"
import { Input } from "@/core/ui/input"
import { cn } from "@/core/lib/utils"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { IconPicker } from "@/notebooks/icon-picker"
import {
  cellColor,
  periodKey,
  deriveHabit,
  displayAmount,
  displayTarget,
  fromDisplay,
  goalText,
  habitHistory,
  HISTORY_WEEKS,
  meets,
  streakText,
  type HabitLogRow,
} from "@/habits/habits"
import { useArchiveHabit, useHabitLog, useHabits, useSaveHabit } from "@/habits/habits.api"
import type { Habit, HabitMetric, HabitPeriod } from "@/core/types/database"

// La vista completa de hábitos: lista + detalle. El detalle ES el form de edición — no hay "modo
// edición", se cambia un campo y se guarda (spec habits-dialog-github).
// Drialog y no ruta: un overlay no reabre "solo 3 pantallas" (ui-principles), mismo criterio que el
// Settings dialog de CONTEXT.md.

export function HabitsDialog({ startNew, onClose }: { startNew: boolean; onClose: () => void }) {
  const { data: habits = [] } = useHabits()
  const { data: log = [] } = useHabitLog()
  const archive = useArchiveHabit()
  // Una sola selección: el id del hábito (null = el primero). `creating` va aparte para que
  // Cancelar en el alta vuelva al que estaba seleccionado.
  const [selId, setSelId] = useState<string | null>(null)
  const [creating, setCreating] = useState(startNew)
  // Ids de antes de crear: `save("habits")` no devuelve la fila, así que el nuevo es el que
  // aparece en el refetch y no estaba acá.
  const [known, setKnown] = useState<string[] | null>(null)
  const [archiving, setArchiving] = useState<Habit | null>(null)
  // Mobile: lista a pantalla completa, el detalle se abre encima con "volver".
  const [detailOpen, setDetailOpen] = useState(startNew)

  const fresh = known && habits.find((h) => !known.includes(h.id))
  // setState en render, no effect: se corrige antes de pintar.
  if (fresh) {
    setKnown(null)
    setCreating(false)
    setSelId(fresh.id)
  }

  const index = Math.max(
    habits.findIndex((h) => h.id === selId),
    0,
  )
  const current = creating ? null : habits[index]

  function select(i: number) {
    const h = habits[i]
    if (!h) return
    setCreating(false)
    setSelId(h.id)
  }

  // Mismo par que entre notas (ADR 0024), forzado en los inputs del form. useHotkeys pelado y no
  // useSafeHotkeys: ese se bloquea con cualquier dialog abierto, y este vive ADENTRO de uno. Se
  // apaga con el ConfirmDelete encima. Sin vuelta: en el último, ⌥J no hace nada.
  // Navegar estando en "Nuevo" sale del alta y vuelve al seleccionado (descarta el draft, story 33).
  const step = (delta: number) => select(creating ? index : index + delta)
  const hotkeys = { enableOnFormTags: true, preventDefault: true, enabled: !archiving }
  useHotkeys("alt+j", () => step(1), hotkeys, [index, creating, habits])
  useHotkeys("alt+k", () => step(-1), hotkeys, [index, creating, habits])
  // ↑/↓ globales en el dialog, sin foco en la lista. SIN enableOnFormTags: en el input numérico y
  // los <select> las flechas son del control.
  useHotkeys("down", () => step(1), { preventDefault: true, enabled: !archiving }, [
    index,
    creating,
    habits,
  ])
  useHotkeys("up", () => step(-1), { preventDefault: true, enabled: !archiving }, [
    index,
    creating,
    habits,
  ])

  function startCreate() {
    setCreating(true)
    setDetailOpen(true)
  }

  return (
    <Drialog open onOpenChange={(next) => !next && onClose()}>
      <DrialogContent showCloseButton={false} className="gap-0 p-0 md:w-240 md:max-w-240">
        {/* Alto FIJO, no max-h: con alto al contenido el dialog salta de tamaño al cambiar de
            hábito, y el `+ Nuevo` se mueve abajo del cursor. */}
        <div className="grid h-[70vh] min-h-0 md:grid-cols-[300px_1fr]">
          <aside
            className={cn(
              "flex min-h-0 flex-col border-r max-md:border-r-0",
              detailOpen && "max-md:hidden",
            )}
          >
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <DrialogTitle className="flex items-baseline gap-2.5 text-lg font-semibold">
                Hábitos
                {habits.length > 0 && (
                  <span className="mono-dim text-sm font-normal whitespace-nowrap">
                    {habits.length} activos
                  </span>
                )}
              </DrialogTitle>
              <Button variant="secondary" size="sm" className="ml-auto" onClick={startCreate}>
                <Plus />
                Nuevo
              </Button>
            </div>
            {habits.length === 0 ? (
              <p className="px-4 py-2 text-sm text-muted-foreground">
                Todavía no hay hábitos. Creá el primero.
              </p>
            ) : (
              <div
                role="listbox"
                aria-label="Hábitos"
                className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2"
              >
                {habits.map((h, i) => {
                  const streak = deriveHabit(h, log).streak
                  const on = h.id === current?.id
                  return (
                    <div
                      key={h.id}
                      id={`habit-opt-${h.id}`}
                      role="option"
                      aria-selected={on}
                      onClick={() => {
                        select(i)
                        setDetailOpen(true)
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent",
                        on && "bg-accent font-medium",
                      )}
                    >
                      <NotebookIcon icon={h.icon} fallback={Target} className="size-4" />
                      <span className="min-w-0 flex-1 truncate">{h.name}</span>
                      {streak >= 2 && (
                        <span className="mono-dim inline-flex items-center gap-0.5 text-xs">
                          <Flame size={10} />
                          {streakText(h, streak)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </aside>

          <section className={cn("min-h-0 min-w-0", !detailOpen && "max-md:hidden")}>
            {(current || creating) && (
              // Keyeado al id: cambiar de hábito descarta el draft (mismo patrón que ADR 0015).
              <HabitForm
                key={current?.id ?? "new"}
                habit={current ?? null}
                log={log}
                onBack={() => setDetailOpen(false)}
                onCancelNew={() => {
                  setCreating(false)
                  setDetailOpen(false)
                }}
                onCreate={() => setKnown(habits.map((h) => h.id))}
                onCreateFailed={() => setKnown(null)}
                onArchive={setArchiving}
              />
            )}
          </section>
        </div>
      </DrialogContent>

      {/* Archivar = soft delete: el habit_log queda intacto y el hábito sale de la tira. */}
      <ConfirmDelete
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        what={archiving?.name ?? ""}
        verb="Archivar"
        onConfirm={() => {
          if (archiving) {
            archive.mutate(archiving.id)
            // El siguiente, o el anterior si era el último; sin ninguno queda el estado vacío.
            const i = habits.findIndex((h) => h.id === archiving.id)
            setSelId((habits[i + 1] ?? habits[i - 1])?.id ?? null)
          }
          setArchiving(null)
        }}
      />
    </Drialog>
  )
}

const METRIC: [HabitMetric, string][] = [
  ["check", "Hecho"],
  ["count", "Cantidad"],
  ["time", "Tiempo"],
]

const PERIOD: [HabitPeriod, string][] = [
  ["day", "cada día"],
  ["week", "por semana"],
  ["month", "por mes"],
]

// El ícono del pill cambia con la métrica: es lo único que distingue los tres pills de un vistazo
// cuando el texto ya scrolleó de la cabeza.
const METRIC_ICON: Record<HabitMetric, typeof Target> = {
  check: Check,
  count: Hash,
  time: Clock,
}

// "min" no pluraliza en español; "vez/veces" sí. En `check` la meta es 1 y el pill ni aparece.
const UNIT: Record<HabitMetric, [string, string]> = {
  check: ["vez", "vez"],
  count: ["vez", "veces"],
  time: ["min", "min"],
}

// El único hint que sobrevive, y sólo cuando aplica: un lun/mié/vie NO se marca en un calendario,
// se modela como cupo (ADR 0009). Sin esta línea el usuario busca dónde elegir los días.
const CUPO = "Es un cupo: no importa qué día lo hagas."

const PILL =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-input pr-3 pl-2.5 text-sm text-fg-secondary"

// Pill con `<select>` nativo transparente ENCIMA. El menú lo dibuja el SO — rueda en iOS, dropdown
// en desktop — así que sale gratis: cero popover propio, cero foco atrapado, y no se anida con el
// IconPicker, que YA es un Dropover (popover dentro de popover se cierran entre ellos).
function SelectPill<T extends string>({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: typeof Target
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div
      className={cn(
        PILL,
        "relative has-[select:focus-visible]:border-ring has-[select:focus-visible]:ring-3 has-[select:focus-visible]:ring-ring/50 hover:bg-accent",
      )}
    >
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      {options.find(([v]) => v === value)?.[1]}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v} className="bg-[Canvas] text-[CanvasText]">
            {text}
          </option>
        ))}
      </select>
    </div>
  )
}

// Dos bloques y la historia en el medio: el nombre como título y una tira de pills con el resto. Se
// probaron dos pasos (qué / cuánto), cards verticales con descripción y una grilla de propiedades
// con labels; las tres sobran — con tres propiedades el label es más largo que el valor.
function HabitForm({
  habit,
  log,
  onBack,
  onCancelNew,
  onCreate,
  onCreateFailed,
  onArchive,
}: {
  habit: Habit | null
  log: HabitLogRow[]
  onBack: () => void
  onCancelNew: () => void
  onCreate: () => void
  onCreateFailed: () => void
  onArchive: (h: Habit) => void
}) {
  const save = useSaveHabit()
  const initial = {
    name: habit?.name ?? "",
    icon: habit?.icon ?? null,
    metric: habit?.metric ?? ("check" as HabitMetric),
    target: String(habit ? displayTarget(habit) : 1),
    period: habit?.period ?? ("day" as HabitPeriod),
  }
  const [draft, setDraft] = useState(initial)
  const set =
    <K extends keyof typeof draft>(k: K) =>
    (v: (typeof draft)[K]) =>
      setDraft((d) => ({ ...d, [k]: v }))
  const { name, icon, metric, target, period } = draft

  // En `check` la meta es 1 y no se pide: o lo hiciste o no. En el resto, piso 1 — una meta de 0 se
  // cumpliría sola todos los días.
  // Para time, el input es minutos pero se guarda en segundos (0011) — la view hace la conversión.
  const rawTarget = metric === "check" ? 1 : Math.max(1, Number(target) || 1)
  const goal = {
    kind: "good" as const,
    metric,
    period,
    target: fromDisplay(metric, rawTarget),
  }

  const dirty = habit
    ? name !== habit.name ||
      icon !== habit.icon ||
      metric !== habit.metric ||
      period !== habit.period ||
      goal.target !== habit.target
    : name.trim() !== ""

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!dirty) return
    if (!habit) onCreate()
    save.mutate(
      {
        id: habit?.id,
        name,
        icon,
        // La app sólo sirve para SOSTENER hábitos, no para dejarlos: `Evitar` salió del form. La
        // columna sigue en la DB y `deriveHabit` sigue sabiendo puntuar un `bad` — los hábitos malos
        // que ya existan siguen andando, pero no se crean más desde acá.
        kind: habit?.kind ?? "good",
        metric,
        // Editar la meta no toca el log: cada fila lleva su target congelado (ADR 0009), así que
        // sólo el período actual se re-puntúa.
        target: goal.target,
        period,
        // `days` salió del form: no entraba en `met`, ni en la racha, ni en los 14 días (ADR 0009).
        // Un lun/mié/vie se modela como `3 por semana`. La columna sigue en la DB; el form la deja
        // en null.
        days: null,
      },
      { onError: onCreateFailed },
    )
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-4 md:px-8 md:pt-7">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 md:hidden"
          onClick={onBack}
        >
          <ChevronLeft />
          Hábitos
        </Button>
        {/* El nombre es el título, no un campo más: sin borde, sin label. El ícono va pegado a la
            izquierda como el emoji de una página. */}
        <div className="mb-4 flex items-center gap-2">
          <IconPicker
            icon={icon}
            onChange={set("icon")}
            className="rounded-lg border-0 bg-transparent hover:bg-accent dark:bg-transparent"
          />
          <Input
            id="habit-name"
            aria-label="Nombre"
            autoFocus={!habit}
            required
            autoComplete="off"
            value={name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="Nombre del hábito"
            className="h-auto rounded-none border-0 bg-transparent px-0 text-2xl font-semibold placeholder:text-muted-foreground/50 focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <SelectPill
            icon={METRIC_ICON[metric]}
            label="Se mide en"
            value={metric}
            options={METRIC}
            onChange={set("metric")}
          />

          {/* En `check` la meta es 1 y no se elige: el pill directamente no existe. Acá el número se
              edita EN el pill — un popover para escribir un entero es un click de más. */}
          {metric !== "check" && (
            <div
              className={cn(
                PILL,
                "gap-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
              )}
            >
              <Target className="size-3.5 text-muted-foreground" aria-hidden />
              <input
                id="habit-target"
                type="number"
                min={1}
                required
                value={target}
                onChange={(e) => set("target")(e.target.value)}
                aria-label={metric === "time" ? "Minutos" : "Veces"}
                className="w-9 bg-transparent text-center tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-muted-foreground">
                {UNIT[metric][goal.target === 1 ? 0 : 1]}
              </span>
            </div>
          )}

          <SelectPill
            icon={CalendarDays}
            label="Frecuencia"
            value={period}
            options={PERIOD}
            onChange={set("period")}
          />
        </div>

        {period !== "day" && <p className="mt-3 text-xs text-muted-foreground">{CUPO}</p>}

        {/* La historia es la del hábito GUARDADO: un draft a medio editar no re-dibuja 26 semanas. */}
        {habit && <HabitGraph habit={habit} log={log} />}
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
        {/* La meta escrita, en vivo: es la misma línea que va a mostrar el tile. */}
        <span className="mono-dim mr-auto text-xs">{goalText(goal)}</span>
        {habit && (
          <Button type="button" variant="ghost" onClick={() => onArchive(habit)}>
            <Archive />
            Archivar
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => (habit ? setDraft(initial) : onCancelNew())}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={!dirty}>
          {habit ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}

const MONTH = new Intl.DateTimeFormat("es", { month: "short" })
const TIP: Record<HabitPeriod, Intl.DateTimeFormat> = {
  day: new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short" }),
  week: new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }),
  month: new Intl.DateTimeFormat("es", { month: "long", year: "numeric" }),
}
const NOUN: Record<HabitPeriod, string> = { day: "días", week: "semanas", month: "meses" }

// Historia de hábito a lo GitHub (ADR 0023: monocromo, tinta sobre --track). Todo período se dibuja
// en el grid diario (columna = semana, 7 filas lun→dom). En semana/mes el día con registro va en
// tinta plena si su período cumplió la meta, a medias si no: el cupo se lee por grupo. Hover apaga
// todo lo que no es el grupo del día (su período: el día solo en diario) + tooltip.
// ponytail: tooltip centrado sin clamp — en la última columna puede asomar al borde del scroll.
function HabitGraph({ habit, log }: { habit: Habit; log: HabitLogRow[] }) {
  const [hover, setHover] = useState<{ key: string; x: number; y: number; text: string } | null>(
    null,
  )
  const isDay = habit.period === "day"
  const days = habitHistory({ ...habit, period: "day" }, log)
  const periods = habitHistory(habit, log)
  const byKey = new Map(periods.map((p) => [periodKey(p.start, habit.period), p]))
  const periodOf = (d: Date) => byKey.get(periodKey(d, habit.period))!
  const group = (d: Date) => periodKey(d, habit.period)

  const cols = Math.ceil(days.length / 7)
  const month = (c: number) => days[c * 7].start.getMonth()
  // Label en la primera columna de cada mes. La columna 0 sólo si su mes sigue 2 columnas más
  // (si no, pisa al label siguiente).
  const label = (c: number) =>
    (c > 0 ? month(c) !== month(c - 1) : month(0) === month(2))
      ? MONTH.format(days[c * 7].start)
      : ""

  const alive = periods.filter((c) => !c.before)
  const met = alive.filter((c) => meets(habit.kind, c.amount, c.target)).length
  const grid = { gridTemplateColumns: `repeat(${cols}, 20px)` }

  const periodTip = (c: (typeof periods)[number]) =>
    `${habit.period === "week" ? "Semana del " : ""}${TIP[habit.period].format(c.start)} · ${
      c.before
        ? "antes de crearlo"
        : `${displayAmount(habit, c.amount)}/${displayTarget({ metric: habit.metric, target: c.target })}`
    }`
  const tip = (c: (typeof days)[number]) =>
    isDay || c.before
      ? periodTip(isDay ? c : periodOf(c.start))
      : `${periodTip(periodOf(c.start))}${
          c.amount ? ` (${TIP.day.format(c.start)}: +${displayAmount(habit, c.amount)})` : ""
        }`

  const color = (c: (typeof days)[number], i: number) => {
    // Antes de crearlo no es "no cumplido": hueco (solo borde), no relleno de --track.
    if (c.before) return "transparent"
    if (isDay) return cellColor(habit.kind, c, i === days.length - 1)
    if (c.amount === 0) return "var(--track)"
    const p = periodOf(c.start)
    return meets(habit.kind, p.amount, p.target)
      ? "var(--foreground)"
      : "color-mix(in oklab, var(--foreground) 40%, var(--track))"
  }

  return (
    <div className="relative mt-6 flex flex-col gap-1.5 overflow-x-auto">
      <span className="mono-dim text-xs">últimas {HISTORY_WEEKS} semanas</span>
      <div className="mono-dim grid gap-1 text-xs" style={grid} aria-hidden>
        {Array.from({ length: cols }, (_, c) => (
          <span key={c} className="whitespace-nowrap">
            {label(c)}
          </span>
        ))}
      </div>
      <div
        role="img"
        aria-label={`Últimas ${HISTORY_WEEKS} semanas de ${habit.name}: ${met} de ${alive.length} ${NOUN[habit.period]} con la meta cumplida`}
        className="grid grid-flow-col gap-1"
        style={{ ...grid, gridTemplateRows: "repeat(7, 20px)" }}
        onMouseLeave={() => setHover(null)}
      >
        {days.map((c, i) => (
          <span
            key={i}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              setHover({
                key: group(c.start),
                x: el.offsetLeft + el.offsetWidth / 2,
                y: el.offsetTop,
                text: tip(c),
              })
            }}
            className={cn(
              "rounded-sm transition-opacity duration-150 ease-out motion-reduce:transition-none",
              c.before && "inset-ring inset-ring-track",
              hover && group(c.start) !== hover.key && "opacity-30",
            )}
            style={{ backgroundColor: color(c, i) }}
          />
        ))}
      </div>
      {hover && (
        <span
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2 py-1 font-mono text-xs whitespace-nowrap text-background shadow-md"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          {hover.text}
        </span>
      )}
    </div>
  )
}
