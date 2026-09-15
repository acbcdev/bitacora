import { useNavigate } from "react-router-dom"
import { BookOpen, Download, Link2, Maximize2, MoreHorizontal, Copy, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { Button } from "@/core/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { useDeleteNote } from "@/notes/notes.api"
import { docToMarkdown, downloadMarkdown } from "@/core/lib/tiptap-markdown"
import type { Note, TiptapDoc } from "@/core/types/database"

// Menú "···" de una nota, compartido por el dialog de Repaso y la pantalla Nota — mismo patrón
// que el menú de notebook (notebook.tsx). Ninguna acción de acá lleva atajo: son de baja frecuencia
// y la convención de teclas (docs/ui-principles.md) reserva las teclas para el loop diario.
//
// `content` es un getter, no el doc: en la pantalla Nota lo que vale es el borrador en vivo
// (autosave debounced 800ms), no el `note.content` que devolvió la query. Puede ser async: el
// sidebar del notebook lista refs sin content (los pide `store.note` recién al copiar/exportar).
//
// `confirming` vive afuera porque el dialog de Repaso tiene que apagar su hotkey de Enter
// mientras el confirm está arriba (si no, Enter marca leído Y cancela a la vez).
//
// `hideNotebook`: el sidebar del cuaderno ya está en ese notebook — el ítem "Ir al notebook"
// sólo tiene sentido fuera de él (dialog de Repaso, nota standalone).
export function NoteActions({
  note,
  content,
  confirming,
  onConfirmingChange,
  onFocus,
  onDeleted,
  hideNotebook,
}: {
  note: Pick<Note, "id" | "title" | "notebook_id">
  content: () => TiptapDoc | Promise<TiptapDoc>
  confirming: boolean
  onConfirmingChange: (open: boolean) => void
  onFocus: () => void
  onDeleted: () => void
  hideNotebook?: boolean
}) {
  const navigate = useNavigate()
  const del = useDeleteNote()

  async function copy(text: string, msg: string) {
    await navigator.clipboard.writeText(text)
    toast.success(msg)
  }

  const title = note.title || "(sin título)"
  const href = `${location.origin}${note.notebook_id ? `/notebook/${note.notebook_id}/${note.id}` : `/note/${note.id}`}`

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Acciones de la nota">
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Acciones</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onFocus}>
            <Maximize2 />
            Focus
          </DropdownMenuItem>
          {!hideNotebook && (
            <DropdownMenuItem
              disabled={!note.notebook_id}
              onSelect={() => navigate(`/notebook/${note.notebook_id}`)}
            >
              <BookOpen />
              Ir al notebook
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => copy(docToMarkdown(await content()), "Nota copiada")}
          >
            <Copy />
            Copiar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy(href, "Link copiado")}>
            <Link2 />
            Copiar link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={async () => downloadMarkdown(note.title, await content())}>
            <Download />
            Export .md
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onConfirmingChange(true)}>
            <Trash2 />
            Borrar nota
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDelete
        open={confirming}
        onOpenChange={onConfirmingChange}
        what={title}
        onConfirm={() => del.mutate(note.id, { onSuccess: onDeleted })}
      />
    </>
  )
}
