import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/core/lib/supabase"
import type { Database, Habit } from "@/core/types/database"
import type { HabitLogRow } from "@/habits/habits"

// Hábitos vivos, en orden de creación. Ese orden es el de la tira y el del chord h>1..9: si algo
// lo reordenara, h>2 sería otro hábito según el día.
export function useHabits() {
  return useQuery({
    queryKey: ["habits"],
    queryFn: async (): Promise<Habit[]> => {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .is("deleted_at", null)
        .order("created_at")
      if (error) throw error
      return data
    },
  })
}

// ponytail: baja el log entero y agrega en JS (igual que useReadStats). Una fila por hábito por
// día son ~3.6k filas/año con 10 hábitos — cabe de sobra en el cliente. Si alguna vez pesa,
// filtrar por `day >= hoy - 400`.
export function useHabitLog() {
  return useQuery({
    queryKey: ["habit_log"],
    queryFn: async (): Promise<HabitLogRow[]> => {
      const { data, error } = await supabase
        .from("habit_log")
        .select("habit_id, day, amount, target")
      if (error) throw error
      return data
    },
  })
}

export type SetDayInput = { habit: Habit; day: string; value: number }

// El ÚNICO camino de escritura del log: un upsert sobre (habit_id, day), no un diff. El +1 del
// tile (`value = hoy + 1`), el toggle de un check (`value = hoy ? 0 : 1`), el stepper del panel y
// la pausa del cronómetro pasan todos por acá. `value = 0` deja la fila en cero: no se borra nada.
export function useSetDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ habit, day, value }: SetDayInput) => {
      // Si la fila ya existía se respeta SU target: el día vale la meta que regía cuando lo
      // empezaste (ADR 0009). El optimismo de abajo copia ese mismo target, así que leerlo del
      // cache acá da el mismo valor corra antes o después.
      // Un día pasado sin fila se congela con el target actual — nadie sabe cuál regía entonces.
      // Es una aproximación consciente, no un descuido.
      const rows = qc.getQueryData<HabitLogRow[]>(["habit_log"]) ?? []
      const target =
        rows.find((r) => r.habit_id === habit.id && r.day === day)?.target ?? habit.target
      const { error } = await supabase
        .from("habit_log")
        .upsert({ habit_id: habit.id, day, amount: value, target }, { onConflict: "habit_id,day" })
      if (error) throw error
    },
    // Optimismo en la UI (ui-principles 4): el número y el relleno se mueven sin esperar el
    // round-trip. Además hace que dos clicks seguidos sumen 2 — el `+1` lee este mismo cache.
    // ponytail: el `+1` se calcula en el cliente. Con dos pestañas abiertas del mismo usuario hay
    // carrera; el día que pase, el incremento se mueve a SQL.
    onMutate: ({ habit, day, value }) => {
      qc.setQueryData<HabitLogRow[]>(["habit_log"], (rows = []) => {
        const prev = rows.find((r) => r.habit_id === habit.id && r.day === day)
        const next = {
          habit_id: habit.id,
          day,
          amount: value,
          target: prev?.target ?? habit.target,
        }
        return prev ? rows.map((r) => (r === prev ? next : r)) : [...rows, next]
      })
    },
    // onSettled y no onSuccess: si el upsert falla, el refetch descarta el optimismo. El aviso lo
    // da el MutationCache global de main.tsx.
    onSettled: () => qc.invalidateQueries({ queryKey: ["habit_log"] }),
  })
}

type HabitInput = Database["public"]["Tables"]["habits"]["Insert"]

// Alta y edición en la misma mutation: el form del dialog es el mismo con y sin `id`.
// Editar target/period/metric NO toca el log — las rachas viejas quedan intactas porque cada fila
// lleva su target congelado (ADR 0009).
export function useSaveHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: HabitInput & { id?: string }) => {
      const { error } = id
        ? await supabase.from("habits").update(input).eq("id", id)
        : await supabase.from("habits").insert(input) // user_id: DB default auth.uid()
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  })
}

// Archivar = soft delete. NUNCA DELETE (CONTEXT.md): el habit_log queda intacto.
export function useArchiveHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("habits")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Hábito archivado")
      qc.invalidateQueries({ queryKey: ["habits"] })
    },
  })
}
