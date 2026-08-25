import { store } from "@/core/store"
import { frozenTarget } from "@/core/store/derive"
import { SNAPSHOT_KEY, useSnapshot, useSnapshotMutation } from "@/core/lib/snapshot"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Habit } from "@/core/types/database"
import type { HabitInput, HabitLogRow, Snapshot } from "@/core/store/types"

// Hábitos vivos, en orden de creación. Ese orden es el de la tira y el del chord h>1..9: si algo
// lo reordenara, h>2 sería otro hábito según el día.
export function useHabits() {
  return useSnapshot((snap) =>
    snap.habits.toSorted((a, b) => a.created_at.localeCompare(b.created_at)),
  )
}

export function useHabitLog() {
  return useSnapshot((snap) => snap.habitLog)
}

export type SetDayInput = { habit: Habit; day: string; value: number }

// El ÚNICO camino de escritura del log: se escribe la fila COMPLETA sobre (habit_id, day). El +1
// del tile, el toggle de un check, el stepper del panel y la pausa del cronómetro pasan todos por
// acá. `value = 0` deja la fila en cero: no se borra nada.
export function useSetDay() {
  const qc = useQueryClient()
  return useSnapshotMutation(
    ({ habit, day, value }: SetDayInput) => {
      // El target congelado lo resuelve `derive.frozenTarget`, una sola vez y del lado de acá:
      // el adapter escribe lo que le dan. Antes cada adapter lo decidía por su cuenta y no
      // coincidían — el local respetaba el guardado y el de Supabase lo pisaba (ADR 0009).
      const log = qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.habitLog ?? []
      return store.save("habit_log", {
        habit_id: habit.id,
        day,
        amount: value,
        target: frozenTarget(log, habit.id, day, habit.target),
      })
    },
    {
      // Optimismo en la UI (ui-principles 4): el número y el relleno se mueven sin esperar el
      // round-trip. Además hace que dos clicks seguidos sumen 2 — el `+1` lee este mismo cache.
      // ponytail: el `+1` se calcula en el cliente. Con dos pestañas abiertas hay carrera; el día
      // que pase, el incremento se mueve a SQL.
      onMutate: ({ habit, day, value }: SetDayInput) => {
        qc.setQueryData<Snapshot>(SNAPSHOT_KEY, (snap) => {
          if (!snap) return snap
          const prev = snap.habitLog.find((r) => r.habit_id === habit.id && r.day === day)
          const next: HabitLogRow = {
            habit_id: habit.id,
            day,
            amount: value,
            target: prev?.target ?? habit.target,
          }
          return {
            ...snap,
            habitLog: prev
              ? snap.habitLog.map((r) => (r === prev ? next : r))
              : [...snap.habitLog, next],
          }
        })
      },
    },
  )
}

// Alta y edición en la misma mutation: el form del dialog es el mismo con y sin `id`.
// Editar target/period/metric NO toca el log — las rachas viejas quedan intactas porque cada fila
// lleva su target congelado (ADR 0009).
export function useSaveHabit() {
  return useSnapshotMutation((input: HabitInput) => store.save("habits", input))
}

// Archivar = soft delete. NUNCA DELETE (CONTEXT.md): el habit_log queda intacto.
export function useArchiveHabit() {
  return useSnapshotMutation((id: string) => store.softDelete("habits", id), {
    onSuccess: () => toast.success("Hábito archivado"),
  })
}
