import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/ui/dialog"
import { Kbd } from "@/core/ui/kbd"

const GROUPS: [string, [string, string][]][] = [
  [
    "Global",
    [
      ["⌘K", "Command palette"],
      ["?", "Este cheatsheet"],
      ["G luego H", "Ir a Hoy"],
      ["G luego C", "Ir a Cursos"],
      ["Esc", "Cerrar / salir"],
    ],
  ],
  [
    "Repaso",
    [
      ["Space", "Marcar leído + siguiente"],
      ["J", "Saltar sin contar"],
      ["K", "Nota anterior"],
    ],
  ],
  [
    "Nota",
    [
      ["F", "Focus mode"],
      ["J / K", "Moverse entre notas del curso"],
      ["Esc", "Salir de focus"],
    ],
  ],
]

export function Cheatsheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-[440px] max-w-[92vw] gap-0 p-0 sm:max-w-[440px]"
      >
        <DialogHeader className="flex-row items-center justify-between border-b px-5 py-4">
          <DialogTitle className="text-base font-semibold">Atajos de teclado</DialogTitle>
          <Kbd>esc</Kbd>
        </DialogHeader>
        <div className="flex flex-col gap-3.5 px-5 pt-3 pb-5">
          {GROUPS.map(([group, items]) => (
            <div key={group}>
              <p className="eyebrow mb-2">{group}</p>
              {items.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b py-1.5 text-sm"
                >
                  <span className="text-fg-secondary">{label}</span>
                  <Kbd>{key}</Kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
