import { useState } from "react"
import { Archive, CalendarDays, Check, Clock, Flame, Hash, Pencil, Target } from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { Button } from "@/core/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/ui/dialog"
import { Input } from "@/core/ui/input"
import { cn } from "@/core/lib/utils"
import { CourseIcon } from "@/courses/course-icon"
import { IconPicker } from "@/courses/icon-picker"
import { deriveHabit, goalText } from "@/habits/habits"
import { useArchiveHabit, useHabitLog, useHabits, useSaveHabit } from "@/habits/habits.api"
import type { Habit, HabitMetric, HabitPeriod } from "@/core/types/database"

// La vista completa de hábitos: crear, editar y archivar.
// Dialog y no ruta: un overlay no reabre "solo 3 pantallas" (ui-principles), mismo criterio que el
// Settings dialog de CONTEXT.md.

export function HabitsDialog({ startNew, onClose }: { startNew: boolean; onClose: () => void }) {
  const { data: habits = [] } = useHabits()
  const { data: log = [] } = useHabitLog()
  const archive = useArchiveHabit()
  // null = la lista; "new" = alta; un Habit = edición. Una sola superficie para las tres.
  const [form, setForm] = useState<Habit | "new" | null>(startNew ? "new" : null)
  const [archiving, setArchiving] = useState<Habit | null>(null)

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="w-120 max-w-[92vw] gap-0 p-0 sm:max-w-120">
        {/* En el form el título visible ES el input del nombre (página de Notion), así que el
            header se esconde — pero el DialogTitle SIGUE montado: Radix lo exige para el
            aria-labelledby del dialog y sin él avisa por consola. */}
        <DialogHeader className={form === null ? "border-b px-6 py-4" : "sr-only"}>
          <DialogTitle className="text-lg font-semibold">
            {form === null ? "Hábitos" : form === "new" ? "Nuevo hábito" : "Editar hábito"}
          </DialogTitle>
        </DialogHeader>

        {form === null ? (
          <div className="px-6 py-5">
            {habits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay hábitos. Creá el primero.
              </p>
            ) : (
              <div className="flex flex-col">
                {habits.map((h) => {
                  const { streak } = deriveHabit(h, log)
                  return (
                    <div
                      key={h.id}
                      className="flex items-center gap-3 border-b py-2.5 text-sm last:border-0"
                    >
                      <CourseIcon icon={h.icon} fallback={Target} />
                      <span className="min-w-0 flex-1 truncate">{h.name}</span>
                      <span className="mono-dim text-xs">{goalText(h)}</span>
                      {streak >= 2 && (
                        <span className="mono-dim inline-flex items-center gap-0.5 text-xs">
                          <Flame size={11} />
                          {streak}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${h.name}`}
                        onClick={() => setForm(h)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Archivar ${h.name}`}
                        onClick={() => setArchiving(h)}
                      >
                        <Archive className="size-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setForm("new")}>+ Nuevo</Button>
            </div>
          </div>
        ) : (
          <HabitForm habit={form === "new" ? null : form} onClose={() => setForm(null)} />
        )}
      </DialogContent>

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
    </Dialog>
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
  const [target, setTarget] = useState(String(habit?.target ?? 1))
  const [period, setPeriod] = useState<HabitPeriod>(habit?.period ?? "day")

  // En `check` la meta es 1 y no se pide: o lo hiciste o no. En el resto, piso 1 — una meta de 0 se
  // cumpliría sola todos los días.
  const goal = {
    kind: "good" as const,
    metric,
    period,
    target: metric === "check" ? 1 : Math.max(1, Number(target) || 1),
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
            className="size-9 rounded-lg border-0 bg-transparent hover:bg-accent dark:bg-transparent [&_svg]:size-4.5"
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
