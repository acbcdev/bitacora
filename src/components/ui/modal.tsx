import { cn } from "@/lib/utils"

// Modal sobre <dialog> nativo: focus trap, Esc y backdrop gratis, sin lib (ui-principles #5).
export function Modal({
  onClose,
  className,
  children,
}: {
  onClose: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal()
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className={cn(
        "fade-in m-auto max-h-[85vh] overflow-hidden rounded-xl border bg-card p-0 text-foreground backdrop:bg-black/55",
        className,
      )}
    >
      {children}
    </dialog>
  )
}
