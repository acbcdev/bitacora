import { NoteDialog } from "@/review/note-dialog"
import type { Notebook } from "@/core/types/database"
import type { Note } from "@/core/types/database"

// El dialog de la nota de Repaso. Antes inline en review.tsx; mismo JSX, extraído tal cual.

export function ReviewNoteDialog({
  openNote,
  notebook,
  dialogOpen,
  setDialogOpen,
  marked,
  reads,
  markReadAndNext,
  openExpanded,
  openFocused,
  next,
}: {
  openNote: Note
  notebook: Notebook | undefined
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
  marked: boolean
  reads: number
  markReadAndNext: () => void
  openExpanded: () => void
  openFocused: () => void
  next: () => void
}) {
  return (
    <NoteDialog
      note={openNote}
      notebook={notebook}
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      marked={marked}
      reads={reads}
      onMarkRead={markReadAndNext}
      onExpand={openExpanded}
      onFocus={openFocused}
      onDeleted={() => {
        setDialogOpen(false)
        next()
      }}
    />
  )
}
