import { useEffect, useRef, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { Maximize2 } from "lucide-react"
import { Editor } from "@/core/components/editor"
import { NoteActions } from "@/notes/note-actions"
import { Button } from "@/core/ui/button"
import { Drialog, DrialogContent, DrialogTitle } from "@/core/ui/drialog"
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
  reads,
  onOpenChange,
  onMarkRead,
  onExpand,
  onFocus,
  onDeleted,
}: {
  note: Note
  course: Course | undefined
  open: boolean
  marked: boolean
  reads: number
  onOpenChange: (open: boolean) => void
  onMarkRead: () => void
  onExpand: () => void
  onFocus: () => void
  onDeleted: () => void
}) {
  // Callback ref, no useRef: Radix monta el contenido un tick después de que `open` pasa a true
  // (patrón Presence) — un efecto atado a [open] solo no vería el nodo real todavía. Con state,
  // el effect de abajo se re-dispara en cuanto el botón se monta.
  const [markReadBtn, setMarkReadBtn] = useState<HTMLButtonElement | null>(null)
  const [readyToMark, setReadyToMark] = useState(false)
  const [confirming, setConfirming] = useState(false)
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

  // `!confirming`: con el ConfirmDelete arriba, Enter es del botón enfocado (Cancelar) — si no,
  // marcaría leído una nota que estás por borrar y mete basura en read_log.
  useHotkeys(
    "enter",
    onMarkRead,
    { preventDefault: true, enabled: open && readyToMark && !marked && !confirming },
    [onMarkRead, open, readyToMark, marked, confirming],
  )

  // mod+enter expande la nota (misma acción que el botón Maximize2). Vive acá — no en Review —
  // porque Review usa useSafeHotkeys y se bloquea solo cuando este dialog está abierto.
  useHotkeys("mod+enter", onExpand, { preventDefault: true, enabled: open && !confirming }, [
    onExpand,
    open,
    confirming,
  ])

  return (
    <Drialog open={open} onOpenChange={onOpenChange}>
      <DrialogContent
        showCloseButton={false}
        // Foco al contenedor scrolleable (no al primer botón) → ↑/↓, PageUp/Down y Space
        // scrollean el dialog con el comportamiento nativo del browser, sin handlers.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          scroller.current?.focus()
        }}
        // El `!` no es pereza: el 80vh de DrawerContent compila a clase + selector de atributo
        // (`[data-vaul-drawer-direction=bottom]`, especificidad 0,2,0) y le gana a una media query
        // pelada (0,1,0) — y twMerge no las ve en conflicto. Acá el alto es superficie de lectura:
        // hay que llegar al final para que el gate deje marcar leído, así que el 20% muerto molesta.
        className="flex flex-col gap-0 overflow-hidden p-0 max-md:max-h-[90vh]! md:max-h-[85vh] md:max-w-5xl"
      >
        {/* Sin X: cerrar es Esc o click afuera (swipe hacia abajo en mobile). Expand a la
            izquierda, acciones a la derecha.
            Barra en flujo (no absolute) para que el scrollbar del contenido arranque debajo y no
            pase por encima de los botones. */}
        <div className="flex shrink-0 items-center justify-between p-2">
          <Button variant="ghost" size="icon-sm" aria-label="Abrir nota en foco" onClick={onExpand}>
            <Maximize2 className="size-3.5" />
          </Button>
          <NoteActions
            note={note}
            content={() => note.content}
            confirming={confirming}
            onConfirmingChange={setConfirming}
            onFocus={onFocus}
            onDeleted={onDeleted}
          />
        </div>

        <div
          ref={scroller}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-8 focus:outline-none sm:px-12 sm:pt-6 sm:pb-10"
        >
          <div className="mx-auto max-w-2xl">
            <p className="eyebrow mb-4 flex items-center gap-1.5">
              <CourseIcon icon={course?.icon ?? null} />
              {course?.name ?? "Sin curso"}
              {/* Cuántas veces se leyó esta nota (filas en read_log): contexto de "¿ya la vi?" */}
              <span className="mono-dim normal-case">
                · {reads === 0 ? "sin repasos" : `${reads} ${reads === 1 ? "repaso" : "repasos"}`}
              </span>
            </p>
            <DrialogTitle className="mb-8 text-2xl font-bold tracking-tight text-pretty sm:text-3xl">
              {note.title || "(sin título)"}
            </DrialogTitle>
            <Editor content={note.content} editable={false} />
            <div className="mt-10 flex items-center justify-end gap-4 border-t pt-6 sm:justify-between">
              <span className="hidden text-xs text-muted-foreground sm:block">
                {marked ? (
                  <>
                    Listo — <Kbd>K</Kbd> para la siguiente
                  </>
                ) : (
                  <>
                    <Kbd>Enter</Kbd> marcar leído y pasar a la siguiente
                  </>
                )}
              </span>
              {/* ref: gate de Enter — el hotkey se arma cuando este botón es visible */}
              <Button ref={setMarkReadBtn} size="lg" disabled={marked} onClick={onMarkRead}>
                {marked ? "Leído" : "Leído y siguiente"}
              </Button>
            </div>
          </div>
        </div>
      </DrialogContent>
    </Drialog>
  )
}
