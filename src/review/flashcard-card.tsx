import { Trash2 } from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { Editor } from "@/core/components/editor"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import type { Notebook, Note } from "@/core/types/database"
import type { NoteRef } from "@/core/store/types"
import type { Grade } from "@/core/types/database"

type Props = {
  item: NoteRef
  notebook?: Notebook
  openNote?: Note
  position: string
  revealed: boolean
  marked: boolean
  onReveal: () => void
  onMark: (grade: Grade) => void
  onPrev: () => void
  onNext: () => void
  confirmingDelete: boolean
  onConfirmingChange: (open: boolean) => void
  onDelete: () => void
}

export function FlashcardCard({
  item,
  notebook,
  openNote,
  position,
  revealed,
  marked,
  onReveal,
  onMark,
  onPrev: _onPrev,
  onNext: _onNext,
  confirmingDelete,
  onConfirmingChange,
  onDelete,
}: Props) {
  void _onPrev
  void _onNext
  return (
    <>
      <div className="mb-6 flex min-h-[2lh] items-start justify-between gap-3">
        <p className="eyebrow">{notebook?.name ?? "Sin notebook"}</p>
        <span className="mono-dim shrink-0 whitespace-nowrap">{position}</span>
      </div>

      <div key={item.id} className="note-in">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight text-pretty">
          {item.title || "(sin título)"}
        </h1>
        {!revealed ? (
          <p className="text-muted-foreground">Pensá tu respuesta y revelala cuando estés listo.</p>
        ) : (
          openNote && <Editor content={openNote.content} editable={false} />
        )}
      </div>

      <div className="relative z-10 mt-8 flex items-center justify-end border-t pt-5 md:justify-between">
        <div className="hidden flex-wrap items-center gap-2 text-xs text-muted-foreground md:flex">
          {revealed ? (
            <span>
              {marked ? (
                <>
                  Listo — <Kbd>K</Kbd> para la siguiente
                </>
              ) : (
                "Elegí correcto / parcial / incorrecto abajo"
              )}
            </span>
          ) : (
            <span>
              <Kbd>Enter</Kbd> revelar respuesta
            </span>
          )}
          <span>
            <Kbd>J</Kbd> volver
          </span>
          <span>
            <Kbd>K</Kbd> siguiente
          </span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {revealed ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                className="hover:text-destructive"
                aria-label="Borrar flashcard"
                onClick={() => onConfirmingChange(true)}
              >
                <Trash2 className="size-3.5" />
              </Button>
              <ConfirmDelete
                open={confirmingDelete}
                onOpenChange={onConfirmingChange}
                what={item.title || "(sin título)"}
                onConfirm={onDelete}
              />
              <Button variant="outline" disabled={marked} onClick={() => onMark("incorrecto")}>
                Incorrecto
              </Button>
              <Button variant="outline" disabled={marked} onClick={() => onMark("parcial")}>
                Parcial
              </Button>
              <Button disabled={marked} onClick={() => onMark("correcto")}>
                Correcto
              </Button>
            </>
          ) : (
            <Button onClick={onReveal}>Revelar respuesta</Button>
          )}
        </div>
      </div>
    </>
  )
}
