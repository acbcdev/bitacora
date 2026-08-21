import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/core/ui/alert-dialog"

// Confirmación de borrado, controlada por estado en vez de por `AlertDialogTrigger`: uno de los
// tres call sites vive adentro de un `DropdownMenu`, que desmonta su contenido al cerrarse y se
// llevaría el trigger puesto. Una sola forma para los tres.
//
// El foco inicial lo toma "Cancelar" — radix lo hace solo en `AlertDialog`, y Esc también cancela.
export function ConfirmDelete({
  open,
  onOpenChange,
  what,
  onConfirm,
  // El verbo se pisa donde la acción no se llama "borrar" en la UI (hábitos: "archivar"). El
  // mecanismo es el mismo soft delete; lo único que cambia es la palabra que ve el usuario.
  verb = "Borrar",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  what: string
  onConfirm: () => void
  verb?: string
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿{verb} “{what}”?
          </AlertDialogTitle>
          <AlertDialogDescription>No se puede deshacer desde la app.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {verb}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
