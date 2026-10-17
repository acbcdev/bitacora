import { useState } from "react"
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
  const [value, setValue] = useState<string | null>(null)
  const shown = value ?? String(goal?.target ?? 3)

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const target = Math.max(1, Math.floor(Number(shown)) || 1)
        save.mutate(
          goal
            ? { id: goal.habit.id, target }
            : { name: "Leer notas", metric: "count", tracks: "reads", target },
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
        className="w-16 text-center"
      />
      <Button type="submit" variant="outline" disabled={save.isPending}>
        Guardar
      </Button>
    </form>
  )
}
