import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { store } from "@/core/store"
import { retention } from "@/core/store/derive"

// Genera flashcards con AI y las inserta como notas `kind: 'flashcard'` — mismo shape que una nota
// normal, sin tabla nueva (ADR 0010). Sólo existe con Supabase: la key vive en la Edge Function.
// La UI pregunta por `store.canGenerateFlashcards` antes de mostrar el botón.
export function useGenerateFlashcards(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => store.generateFlashcards(courseId),
    // Sin onError acá: el MutationCache global (main.tsx) ya avisa con el mensaje real
    // en cualquier mutation que falla — uno propio duplicaría el toast.
    onSuccess: () => {
      toast.success("Flashcards generadas")
      qc.invalidateQueries({ queryKey: ["review_queue"] })
    },
  })
}

// % de retención por curso, derivado de read_log.grade (ADR 0003 — nada denormalizado):
// correcto / total de autoevaluaciones. El adapter trae las filas crudas y `derive.retention`
// las agrega — el mismo cálculo para los dos backends.
export function useRetention() {
  return useQuery({
    queryKey: ["retention"],
    queryFn: async () => retention(await store.gradedReads()),
  })
}
