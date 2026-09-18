import { ConfirmDelete } from "@/core/components/confirm-delete"
import type { NotebookRow } from "@/core/types/database"

// Confirmación de borrar (Enter/Delete sobre la fila seleccionada o el menú de acciones).
// Antes inline en notebooks.tsx; mismo JSX, extraído tal cual.
export function NotebookDeleteConfirm({
  target,
  onConfirm,
  onClose,
}: {
  target: NotebookRow | null
  onConfirm: (id: string) => void
  onClose: () => void
}) {
  return (
    <ConfirmDelete
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      what={target?.name ?? ""}
      onConfirm={() => {
        if (target) onConfirm(target.id)
      }}
    />
  )
}
