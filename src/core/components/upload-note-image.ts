import { toast } from "sonner"
import { store } from "@/core/store"

// Sube una imagen de nota con el feedback de toasts. Compartido por los dos caminos de entrada:
// el paste del editor (editor.tsx handlePaste) y el ítem "Imagen" del menú slash (slash-menu.tsx),
// que difieren sólo en cómo insertan el `src`.
export function uploadNoteImageWithToast(file: File, insert: (src: string) => void) {
  toast.promise(store.uploadNoteImage(file).then(insert), {
    loading: "Subiendo imagen…",
    success: "Imagen insertada",
    error: (e) => (e instanceof Error ? e.message : "No se pudo subir la imagen"),
  })
}
