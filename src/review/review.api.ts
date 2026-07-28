import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/core/lib/supabase"
import type { Note } from "@/core/types/database"

// Cola de repaso (review/01): RPC review_queue() — notas de cursos active, no borradas,
// más viejas primero (nunca-leídas primero), limit 3. Ver migrations/0003.
export function useReviewQueue() {
  return useQuery({
    queryKey: ["review_queue"],
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await supabase.rpc("review_queue")
      if (error) throw error
      return data
    },
  })
}

// Space marca leído: insert exactamente una fila en read_log (review/03). NUNCA se borra.
export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("read_log").insert({ note_id: noteId })
      if (error) throw error
    },
    // Solo progreso (derivado — ADR 0003). La cola NO se invalida acá: reshufflearía el batch
    // bajo el usuario mid-repaso. Se refetchea al terminar el batch (ver Review screen).
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course_progress"] }),
  })
}
