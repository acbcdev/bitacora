import { store } from "@/core/store"
import { reviewQueue } from "@/core/store/derive"
import { useSnapshot, useSnapshotMutation } from "@/core/lib/snapshot"

// Cola de repaso: notas vivas de notebooks vivos, la más vieja primero, nunca-leídas antes que todo.
// Devuelve la cola completa (sin batch, ADR 0025) como refs — el `content` de la que se está
// mirando lo pide Repaso con `useNote(id)`, así abrir la pantalla no baja todos los documentos.
export function useReviewQueue() {
  return useSnapshot(reviewQueue)
}

// Marcar leído: exactamente una fila en read_log. NUNCA se borra.
export function useMarkRead() {
  return useSnapshotMutation(({ noteId }: { noteId: string }) =>
    store.save("read_log", { note_id: noteId }),
  )
}
