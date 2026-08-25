import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { store } from "@/core/store"
import type { Grade } from "@/core/types/database"

// Cola de repaso: notas de cursos vivos, más viejas primero (nunca-leídas primero), limit 3.
// En Supabase la resuelve la RPC `review_queue()` (migración 0003); en local, `derive.reviewQueue`
// con la misma semántica.
export function useReviewQueue() {
  return useQuery({ queryKey: ["review_queue"], queryFn: () => store.reviewQueue() })
}

// Space marca leído: exactamente una fila en read_log (review/03). NUNCA se borra.
// `grade` solo se completa cuando el ítem repasado es una flashcard (flashcards/spec).
export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { noteId: string; grade?: Grade }) => store.markRead(input),
    // Solo las stats derivadas de read_log (ADR 0003): "leídas hoy", racha y repasos por nota.
    // La cola NO se invalida acá: reshufflearía el batch bajo el usuario mid-repaso. Se refetchea
    // al terminar el batch (ver Review screen).
    onSuccess: () => qc.invalidateQueries({ queryKey: ["read_stats"] }),
  })
}
