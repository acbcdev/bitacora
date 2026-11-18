import { useEffect, useState } from "react"
import { Button } from "@/core/ui/button"
import { Input } from "@/core/ui/input"
import { useSnapshot } from "@/core/lib/snapshot"
import { readGoal } from "@/core/store/derive"
import { useSaveHabit } from "@/habits/habits.api"

// La meta de lectura: alta (onboarding en Hoy) y edición (Ajustes) en el mismo form. Guarda el
// hábito `tracks = 'reads'` — uno solo por usuario (migración 0014).
export function ReadGoalForm() {
  const { data: goal } = useSnapshot((s) => readGoal(s))
  const save = useSaveHabit()
  const { mutate } = save // estable en TanStack: seguro como dep del efecto
  const [value, setValue] = useState<string | null>(null)
  const shown = value ?? String(goal?.target ?? 3)
  const target = Math.max(1, Math.floor(Number(shown)) || 1)

  // Con meta ya creada se guarda solo, 800ms después de dejar de tipear. Sin meta (onboarding)
  // queda el botón: crear es una decisión, editar no.
  useEffect(() => {
    if (!goal || value === null || target === goal.target) return
    const t = setTimeout(
      () => mutate({ id: goal.habit.id, target }, { onSuccess: () => setValue(null) }),
      800,
    )
    return () => clearTimeout(t)
  }, [goal, value, target, mutate])

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (goal) return
        save.mutate(
          { name: "Leer notas", metric: "count", tracks: "reads", target },
          { onSuccess: () => setValue(null) },
        )
      }}
    >
      <Input
        type="number"
        min={1}
        value={shown}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Notas por día"
        className="w-16 text-center max-md:text-md"
      />
      {!goal && (
        <Button type="submit" variant="secondary" disabled={save.isPending}>
          Guardar
        </Button>
      )}
    </form>
  )
}
