import { toast } from "sonner"
import { store } from "@/core/store"
import { retention } from "@/core/store/derive"
import { useSnapshot, useSnapshotMutation } from "@/core/lib/snapshot"

// Genera flashcards con AI y las inserta como notas `kind: 'flashcard'` — mismo shape que una nota
// normal, sin tabla nueva (ADR 0010). Sólo existe con Supabase: la key vive en la Edge Function.
// La UI pregunta por `store.canGenerateFlashcards` antes de mostrar el botón.
export function useGenerateFlashcards(notebookId: string) {
  return useSnapshotMutation<void, void>(() => store.generateFlashcards(notebookId), {
    // Sin onError acá: el MutationCache global (main.tsx) ya avisa con el mensaje real
    // en cualquier mutation que falla — uno propio duplicaría el toast.
    onSuccess: () => toast.success("Flashcards generadas"),
  })
}

// % de retención por notebook, derivado de read_log.grade (ADR 0003 — nada denormalizado):
// correcto / total de autoevaluaciones. Mismo cálculo para los dos backends.
export function useRetention() {
  return useSnapshot(retention)
}
