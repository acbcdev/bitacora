import { useState } from "react"
import { Archive, Flame, Pencil, Target } from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { Button } from "@/core/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/core/ui/field"
import { Input } from "@/core/ui/input"
import { NativeSelect } from "@/core/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/core/ui/toggle-group"
import { CourseIcon } from "@/courses/course-icon"
import { IconPicker } from "@/courses/icon-picker"
import { daysText, deriveHabit, goalText } from "@/habits/habits"
import { useArchiveHabit, useHabitLog, useHabits, useSaveHabit } from "@/habits/habits.api"
import type { Habit, HabitKind, HabitMetric, HabitPeriod } from "@/core/types/database"

// La vista completa de hábitos: crear, editar, archivar y —único lugar de la app— los `days`.
// Dialog y no ruta: un overlay no reabre "solo 3 pantallas" (ui-principles), mismo criterio que el
// Settings dialog de CONTEXT.md.

const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"]

export function HabitsDialog({ startNew, onClose }: { startNew: boolean; onClose: () => void }) {
  const { data: habits = [] } = useHabits()
  const { data: log = [] } = useHabitLog()
  const archive = useArchiveHabit()
  // null = la lista; "new" = alta; un Habit = edición. Una sola superficie para las tres.
  const [form, setForm] = useState<Habit | "new" | null>(startNew ? "new" : null)
  const [archiving, setArchiving] = useState<Habit | null>(null)

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="w-115 max-w-[92vw] gap-0 p-0 sm:max-w-115">
        <DialogHeader className="border-b px-8 py-6">
          <DialogTitle className="text-lg font-semibold">
            {form === null ? "Hábitos" : form === "new" ? "Nuevo hábito" : "Editar hábito"}
          </DialogTitle>
        </DialogHeader>

        {form === null ? (
          <div className="px-8 py-6">
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
                      {/* El schedule sólo se lee acá: no entra en ningún cálculo (ADR 0009). */}
                      {h.days?.length ? (
                        <span className="mono-dim text-xs">{daysText(h)}</span>
                      ) : null}
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

// Qué significa el target según la métrica. En `check` no se pide: o lo hiciste o no.
const TARGET_LABEL: Record<HabitMetric, string> = {
  check: "",
  count: "Veces",
  time: "Minutos",
}

function HabitForm({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const save = useSaveHabit()
  const [name, setName] = useState(habit?.name ?? "")
  const [icon, setIcon] = useState(habit?.icon ?? null)
  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? "good")
  const [metric, setMetric] = useState<HabitMetric>(habit?.metric ?? "check")
  const [target, setTarget] = useState(String(habit?.target ?? 1))
  const [period, setPeriod] = useState<HabitPeriod>(habit?.period ?? "day")
  const [days, setDays] = useState(habit?.days?.map(String) ?? [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    save.mutate(
      {
        id: habit?.id,
        name,
        icon,
        kind,
        metric,
        // Editar la meta no toca el log: cada fila lleva su target congelado (ADR 0009), así que
        // sólo el período actual se re-puntúa.
        target: metric === "check" ? 1 : Math.max(0, Number(target) || 0),
        period,
        days: days.length ? days.map(Number).toSorted((a, b) => a - b) : null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup className="px-8 py-6">
        <Field>
          <FieldLabel htmlFor="habit-name" className="eyebrow">
            Nombre
          </FieldLabel>
          <div className="flex items-center gap-2">
            <IconPicker icon={icon} onChange={setIcon} />
            <Input
              id="habit-name"
              autoFocus
              required
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Gym"
              className="h-10"
            />
          </div>
        </Field>

        <FieldGroup className="flex-row">
          <Field>
            <FieldLabel htmlFor="habit-kind" className="eyebrow">
              Tipo
            </FieldLabel>
            <NativeSelect
              id="habit-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as HabitKind)}
              className="w-full [&>select]:h-10 [&>select]:text-base"
            >
              <option value="good">bueno</option>
              <option value="bad">malo</option>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="habit-metric" className="eyebrow">
              Se mide en
            </FieldLabel>
            <NativeSelect
              id="habit-metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value as HabitMetric)}
              className="w-full [&>select]:h-10 [&>select]:text-base"
            >
              <option value="check">hecho / no hecho</option>
              <option value="count">cantidad</option>
              <option value="time">tiempo</option>
            </NativeSelect>
          </Field>
        </FieldGroup>

        <FieldGroup className="flex-row">
          {/* Con `check` el target se fija en 1 y no se pide. */}
          {metric !== "check" && (
            <Field>
              <FieldLabel htmlFor="habit-target" className="eyebrow">
                {TARGET_LABEL[metric]}
              </FieldLabel>
              <Input
                id="habit-target"
                type="number"
                min={0}
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="h-10"
              />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="habit-period" className="eyebrow">
              Por
            </FieldLabel>
            <NativeSelect
              id="habit-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as HabitPeriod)}
              className="w-full [&>select]:h-10 [&>select]:text-base"
            >
              <option value="day">día</option>
              <option value="week">semana</option>
              <option value="month">mes</option>
            </NativeSelect>
          </Field>
        </FieldGroup>
        <FieldDescription>
          {kind === "good"
            ? "Es un piso: cumplís cuando llegás a ese número en el período."
            : "Es un techo: cumplís mientras no lo pases en el período."}
        </FieldDescription>

        <Field>
          <FieldLabel className="eyebrow">Días</FieldLabel>
          <ToggleGroup type="multiple" variant="outline" value={days} onValueChange={setDays}>
            {WEEKDAYS.map((d, i) => (
              <ToggleGroupItem key={i} value={String(i)} aria-label={`Día ${i}`} className="flex-1">
                {d}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {/* Sin esta línea el usuario asume que marcar lun/mié/vie cambia la racha, que es justo
              lo que ADR 0009 decidió que NO pase. */}
          <FieldDescription>
            Recordatorio: no afecta la meta. Si lo hacés otro día cuenta igual.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2 border-t px-8 py-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">{habit ? "Guardar" : "Crear hábito"}</Button>
      </div>
    </form>
  )
}
