import { useState } from "react"
import {
  Archive,
  CalendarDays,
  Check,
  Clock,
  Flame,
  Hash,
  MoreHorizontal,
  Pencil,
  Plus,
  Target,
} from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { Button } from "@/core/ui/button"
import { Drialog, DrialogContent, DrialogHeader, DrialogTitle } from "@/core/ui/drialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { Input } from "@/core/ui/input"
import { cn } from "@/core/lib/utils"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { IconPicker } from "@/notebooks/icon-picker"
import { deriveHabit, goalText, streakText } from "@/habits/habits"
import { HabitHistory } from "@/habits/habit-panel"
import { useArchiveHabit, useHabitLog, useHabits, useSaveHabit } from "@/habits/habits.api"
import type { Habit, HabitMetric, HabitPeriod } from "@/core/types/database"

// La vista completa de hábitos: crear, editar y archivar.
// Drialog y no ruta: un overlay no reabre "solo 3 pantallas" (ui-principles), mismo criterio que el
// Settings dialog de CONTEXT.md.

export function HabitsDialog({ startNew, onClose }: { startNew: boolean; onClose: () => void }) {
  const { data: habits = [] } = useHabits()
  const { data: log = [] } = useHabitLog()
  const archive = useArchiveHabit()
  // null = la lista; "new" = alta; un Habit = edición. Una sola superficie para las tres.
  const [form, setForm] = useState<Habit | "new" | null>(startNew ? "new" : null)
  const [archiving, setArchiving] = useState<Habit | null>(null)

  return (
    <Drialog open onOpenChange={(next) => !next && onClose()}>
      <DrialogContent
        showCloseButton={false}
        className={cn(
          "gap-0 p-0",
          form === null ? "md:w-240 md:max-w-240" : "sm:max-w-[520px] md:max-w-[520px]",
        )}
      >
        {/* En el form el título visible ES el input del nombre (página de Notion), así que el
            header se esconde — pero el DrialogTitle SIGUE montado: la primitiva lo exige para el
            aria-labelledby del overlay y sin él avisa por consola. */}
        <DrialogHeader className={form === null ? "px-6 pt-5 pb-3" : "sr-only"}>
          <div className="flex items-center gap-3">
            <DrialogTitle className="flex items-baseline gap-3 text-lg font-semibold">
              {form === null ? "Hábitos" : form === "new" ? "Nuevo hábito" : "Editar hábito"}
              {form === null && habits.length > 0 && (
                <span className="mono-dim text-xs font-normal">{habits.length} activos</span>
              )}
            </DrialogTitle>
            {form === null && (
              <Button variant="outline" className="ml-auto" onClick={() => setForm("new")}>
                <Plus />
                Nuevo
              </Button>
            )}
          </div>
        </DrialogHeader>

        {form === null ? (
          /* Alto FIJO, no max-h: con alto al contenido el dialog salta de tamaño al crear,
             archivar o pasar de la lista al form, y el `+ Nuevo` del header se mueve abajo del
             cursor. `content-start` para que las filas no se estiren a llenar el hueco.
             Cards y no filas: es la MISMA forma que la tira de Hoy, así que la lista no estrena un
             lenguaje propio — y en una card entran los 14 días, que en una fila no entraban. */
          <div className="grid h-[70vh] grid-cols-1 content-start gap-2.5 overflow-y-auto px-6 pt-1 pb-6 sm:grid-cols-2 md:grid-cols-3">
            {habits.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Todavía no hay hábitos. Creá el primero.
              </p>
            )}
            {habits.map((h) => {
              const state = deriveHabit(h, log)
              return (
                <div
                  key={h.id}
                  className="group flex flex-col gap-3 rounded-lg border bg-card p-3.5 transition-colors hover:border-input"
                >
                  <div className="flex items-start justify-between gap-2">
                    <NotebookIcon icon={h.icon} fallback={Target} className="size-4.5" />
                    {/* Un menú y no dos íconos sueltos: en la lista vieja el lápiz y el archivar
                        estaban SIEMPRE encendidos en cada fila y eran lo más ruidoso del dialog.
                        En mobile no hay hover donde esconderlo, así que ahí queda visible. */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones de ${h.name}`}
                          className="-mt-1 -mr-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setForm(h)}>
                          <Pencil /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => setArchiving(h)}>
                          <Archive /> Archivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{h.name}</span>
                      {state.streak >= 2 && (
                        <span className="mono-dim inline-flex items-center gap-0.5 text-[10px]">
                          <Flame size={10} />
                          {streakText(h, state.streak)}
                        </span>
                      )}
                    </div>
                    <span className="mono-dim text-xs">{goalText(h)}</span>
                  </div>

                  {/* El mismo bloque de 14 días del tooltip del tile, sin variante propia. */}
                  <HabitHistory habit={h} state={state} />
                </div>
              )
            })}
          </div>
        ) : (
          <HabitForm habit={form === "new" ? null : form} onClose={() => setForm(null)} />
        )}
      </DrialogContent>

      {/* Archivar = soft delete: el habit_log queda intacto y el hábito sale de la tira. */}
      <ConfirmDelete
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        what={archiving?.name ?? ""}
        verb="Archivar"
        onConfirm={() => {
          if (archiving) archive.mutate(archiving.id)
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

// Dos bloques y nada más: el nombre como título y una tira de pills con el resto. Se probaron dos
// pasos (qué / cuánto), cards verticales con descripción y una grilla de propiedades con labels;
// las tres sobran — con tres propiedades el label es más largo que el valor que describe.
function HabitForm({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const save = useSaveHabit()
  const [name, setName] = useState(habit?.name ?? "")
  const [icon, setIcon] = useState(habit?.icon ?? null)
  const [metric, setMetric] = useState<HabitMetric>(habit?.metric ?? "check")
  const [target, setTarget] = useState(
    String(habit ? (habit.metric === "time" ? Math.round(habit.target / 60) : habit.target) : 1),
  )
  const [period, setPeriod] = useState<HabitPeriod>(habit?.period ?? "day")

  // En `check` la meta es 1 y no se pide: o lo hiciste o no. En el resto, piso 1 — una meta de 0 se
  // cumpliría sola todos los días.
  // Para time, el input es minutos pero se guarda en segundos (0011) — la view hace la conversión.
  const rawTarget = metric === "check" ? 1 : Math.max(1, Number(target) || 1)
  const goal = {
    kind: "good" as const,
    metric,
    period,
    target: metric === "time" ? rawTarget * 60 : rawTarget,
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    save.mutate(
      {
        id: habit?.id,
        name,
        icon,
        // La app sólo sirve para SOSTENER hábitos, no para dejarlos: `Evitar` salió del form. La
        // columna sigue en la DB y `deriveHabit` sigue sabiendo puntuar un `bad` — los hábitos malos
        // que ya existan siguen andando, pero no se crean más desde acá.
        kind: "good",
        metric,
        // Editar la meta no toca el log: cada fila lleva su target congelado (ADR 0009), así que
        // sólo el período actual se re-puntúa.
        target: goal.target,
        period,
        // `days` salió del form: no entraba en `met`, ni en la racha, ni en los 14 días (ADR 0009),
        // así que era un control que no hacía nada y encima contradecía "cada día". Un lun/mié/vie
        // se modela como `3 por semana`. La columna sigue en la DB; el form la deja en null.
        days: null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <form onSubmit={submit}>
      <div className="px-5 pt-5 pb-4">
        {/* El nombre es el título, no un campo más: sin borde, sin label. El ícono va pegado a la
            izquierda como el emoji de una página. */}
        <div className="mb-4 flex items-center gap-2">
          <IconPicker
            icon={icon}
            onChange={setIcon}
            className="rounded-lg border-0 bg-transparent hover:bg-accent dark:bg-transparent"
          />
          <Input
            id="habit-name"
            aria-label="Nombre"
            autoFocus
            required
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del hábito"
            className="h-auto rounded-none border-0 bg-transparent px-0 text-xl font-semibold placeholder:text-muted-foreground/50 focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <SelectPill
            icon={METRIC_ICON[metric]}
            label="Se mide en"
            value={metric}
            options={METRIC}
            onChange={setMetric}
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
                onChange={(e) => setTarget(e.target.value)}
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
            onChange={setPeriod}
          />
        </div>

        {period !== "day" && <p className="mt-3 text-xs text-muted-foreground">{CUPO}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
        {/* La meta escrita, en vivo: es la misma línea que va a mostrar el tile. Antes se armaba a
            ciegas y recién se leía cuando el hábito ya existía. */}
        <span className="mono-dim mr-auto text-xs">{goalText(goal)}</span>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">{habit ? "Guardar" : "Crear"}</Button>
      </div>
    </form>
  )
}
