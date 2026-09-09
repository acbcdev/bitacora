import { store } from "@/core/store"
import { reviewQueue } from "@/core/store/derive"
import { useSnapshot, useSnapshotMutation } from "@/core/lib/snapshot"
import type { Grade } from "@/core/types/database"

// El mismo `limit 3` que tenía la RPC `review_queue` (migración 0003).
export const REVIEW_BATCH = 3

// Cola de repaso: notas vivas de notebooks vivos, la más vieja primero, nunca-leídas antes que todo.
// Devuelve refs — el `content` de la que se está mirando lo pide Repaso con `useNote(id)`, así
// abrir la pantalla no baja tres documentos Tiptap para mostrar uno.
export function useReviewQueue() {
  return useSnapshot((snap) => reviewQueue(snap, REVIEW_BATCH))
}

// Marcar leído: exactamente una fila en read_log. NUNCA se borra.
// `grade` sólo se completa cuando el ítem repasado es una flashcard.
export function useMarkRead() {
  return useSnapshotMutation(({ noteId, grade }: { noteId: string; grade?: Grade }) =>
    store.save("read_log", { note_id: noteId, grade }),
  )
}
