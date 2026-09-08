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

export type SetDayInput = { habit: Habit; day: string; value?: number; delta?: number }

// El ÚNICO camino de escritura del log: se escribe la fila COMPLETA sobre (habit_id, day). El +1
// del tile, el toggle de un check, el stepper del panel y la pausa del cronómetro pasan todos por
// acá. `value = 0` deja la fila en cero: no se borra nada.
// `value` es un SET absoluto (toggle de check, input tecleado del panel, pausa del cronómetro);
// `delta` es un +/− relativo. La corrección vive acá y no en el caller: si dos taps llegan antes
// de que React repinte, el segundo todavía ve la render vieja — pero el onMutate lee el cache
// más fresco en el instante del mutate, así que dos taps suman 2 y no dos veces 1.
// ponytail: el delta se calcula en el cliente. Con dos pestañas abiertas hay carrera; el día que
// pase, el incremento se mueve a SQL (amount = amount + 1 en el upsert).
const nextAmount = (prev: HabitLogRow | undefined, { value, delta }: SetDayInput) =>
  value !== undefined ? value : Math.max(0, (prev?.amount ?? 0) + (delta ?? 0))

export function useSetDay() {
  const qc = useQueryClient()
  return useSnapshotMutation(
    (input: SetDayInput) => {
      const { habit, day } = input
      // El onMutate ya resolvió el delta contra el cache: la fila que persistimos es LA MISMA que
      // dejó el optimismo. Recalcular acá contaría el delta dos veces (mutate → onMutate → fn). Si
      // el cache estaba vacío, onMutate no escribió nada y se resuelve pelado.
      // El target congelado lo resuelve `derive.frozenTarget`, una sola vez y del lado de acá:
      // el adapter escribe lo que le dan (ADR 0009).
      const log = qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.habitLog ?? []
      const prev = log.find((r) => r.habit_id === habit.id && r.day === day)
      return store.save("habit_log", {
        habit_id: habit.id,
        day,
        amount: prev?.amount ?? nextAmount(undefined, input),
        target: prev?.target ?? frozenTarget(log, habit.id, day, habit.target),
      })
    },
    {
      // Optimismo en la UI (ui-principles 4): el número y el relleno se mueven sin esperar el
      // round-trip. El +/− se aplica sobre ESTE cache (el más fresco), no sobre la render.
      onMutate: (input: SetDayInput) => {
        qc.setQueryData<Snapshot>(SNAPSHOT_KEY, (snap) => {
          if (!snap) return snap
          const prev = snap.habitLog.find(
            (r) => r.habit_id === input.habit.id && r.day === input.day,
          )
          const next: HabitLogRow = {
            habit_id: input.habit.id,
            day: input.day,
            amount: nextAmount(prev, input),
            target: prev?.target ?? input.habit.target,
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
