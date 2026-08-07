import { useEffect, useRef, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { Maximize2 } from "lucide-react"
import { Editor } from "@/core/components/editor"
import { Button } from "@/core/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/core/ui/dialog"
import { Kbd } from "@/core/ui/kbd"
import { CourseIcon } from "@/courses/course-icon"
import type { Course, Note } from "@/core/types/database"

// La nota de Repaso en grande, estilo "página" (Notion-like): todo en flujo normal dentro de una
// columna centrada, sin header/footer fijos — solo el expand flota arriba a la izquierda.
// Vive fuera de Review porque el gate de Enter es suyo: mientras está abierto, Enter lo maneja
// este componente (Review desactiva el suyo con `enabled: !dialogOpen`).
export function NoteDialog({
  note,
  course,
  open,
  marked,
  onOpenChange,
  onMarkRead,
  onExpand,
}: {
  note: Note
  course: Course | undefined
  open: boolean
  marked: boolean
  onOpenChange: (open: boolean) => void
  onMarkRead: () => void
  onExpand: () => void
}) {
  // Callback ref, no useRef: Radix monta el contenido un tick después de que `open` pasa a true
  // (patrón Presence) — un efecto atado a [open] solo no vería el nodo real todavía. Con state,
  // el effect de abajo se re-dispara en cuanto el botón se monta.
  const [markReadBtn, setMarkReadBtn] = useState<HTMLButtonElement | null>(null)
  const [readyToMark, setReadyToMark] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  // Gate de "Enter marca leído": recién se arma cuando el botón "Marcar leído" (al final del
  // contenido) es visible — evita marcar leído sin haber llegado a leerlo.
  useEffect(() => {
    setReadyToMark(false)
    if (!open || !markReadBtn) return
    const observer = new IntersectionObserver(([entry]) => setReadyToMark(entry.isIntersecting))
    observer.observe(markReadBtn)
    return () => observer.disconnect()
  }, [open, markReadBtn])

  useHotkeys(
    "enter",
    onMarkRead,
    { preventDefault: true, enabled: open && readyToMark && !marked },
    [onMarkRead, open, readyToMark, marked],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // Foco al contenedor scrolleable (no al primer botón) → ↑/↓, PageUp/Down y Space
        // scrollean el dialog con el comportamiento nativo del browser, sin handlers.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          scroller.current?.focus()
        }}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        {/* Sin X: cerrar es Esc o click afuera. Solo el expand arriba a la izquierda. */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 left-2 z-10"
          aria-label="Abrir nota en foco"
          onClick={onExpand}
        >
          <Maximize2 className="size-3.5" />
        </Button>

        <div
          ref={scroller}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-8 focus:outline-none sm:px-12 sm:py-10"
        >
          <div className="mx-auto max-w-2xl">
            <p className="eyebrow mb-4 flex items-center gap-1.5">
              <CourseIcon icon={course?.icon ?? null} />
              {course?.name ?? "Sin curso"}
            </p>
            <DialogTitle className="mb-8 text-2xl font-bold tracking-tight text-pretty sm:text-3xl">
              {note.title || "(sin título)"}
            </DialogTitle>
            <Editor content={note.content} editable={false} />
            <div className="mt-10 flex items-center justify-end gap-4 border-t pt-6 sm:justify-between">
              <span className="hidden text-xs text-muted-foreground sm:block">
                {marked ? (
                  <>
                    Listo — <Kbd>K</Kbd> para la siguiente
                  </>
                ) : (
                  <>
                    <Kbd>Enter</Kbd> marcar leído
                  </>
                )}
              </span>
              {/* ref: gate de Enter — el hotkey se arma cuando este botón es visible */}
              <Button ref={setMarkReadBtn} size="lg" disabled={marked} onClick={onMarkRead}>
                {marked ? "Leído" : "Marcar leído"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
