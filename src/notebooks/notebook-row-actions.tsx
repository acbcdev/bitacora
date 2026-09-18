import { useState } from "react"
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { Button } from "@/core/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { togglePinnedNotebook, usePinnedNotebookIds } from "@/notebooks/pinned-notebooks"
import type { Notebook } from "@/core/types/database"

// Editar / borrar en un menú — la fila/card entera navega al notebook.
export function NotebookRowActions({
  notebook,
  onEdit,
  onDelete,
}: {
  notebook: Notebook
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const pinned = usePinnedNotebookIds().includes(notebook.id)

  return (
    // El menú se portalea pero React igual propaga el click por el árbol, así que el
    // stopPropagation va en los dos lados: si no, elegir una acción navega al notebook.
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${notebook.name}`}>
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Acciones</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => togglePinnedNotebook(notebook.id)}>
          {pinned ? <PinOff /> : <Pin />}
          {pinned ? "Desfijar" : "Fijar"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
          <Trash2 />
          Borrar
        </DropdownMenuItem>
      </DropdownMenuContent>

      <ConfirmDelete
        open={confirming}
        onOpenChange={setConfirming}
        what={notebook.name}
        onConfirm={onDelete}
      />
    </DropdownMenu>
  )
}
