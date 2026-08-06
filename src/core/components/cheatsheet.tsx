import { mod } from "@/core/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/core/ui/dialog"
import { Kbd } from "@/core/ui/kbd"

const GROUPS: [string, [string, string][]][] = [
  [
    "Global",
    [
      [mod("K"), "Command palette"],
      [mod("/"), "Este cheatsheet"],
      ["G luego H", "Ir a Hoy"],
      ["G luego C", "Ir a Cursos"],
      ["Esc", "Cerrar / salir"],
    ],
  ],
  [
    "Repaso",
    [
      ["Enter", "Marcar leído + siguiente"],
      ["J", "Volver, sin contar"],
      ["K", "Siguiente, sin contar"],
    ],
  ],
  [
    "Cursos",
    [
      ["J / K", "Moverse por la lista"],
      ["Enter", "Abrir el curso seleccionado"],
      ["E", "Editar el curso seleccionado"],
      ["Delete", "Borrar el curso seleccionado"],
      ["/", "Buscar"],
      ["N", "Nuevo curso"],
    ],
  ],
  [
    "Nota",
    [
      ["F", `Focus mode (${mod("F")} si estás escribiendo)`],
      ["J / K", `Moverse entre notas (${mod("J")} / ${mod("K")} si estás escribiendo)`],
      ["N", "Nueva nota"],
      [mod("Backspace"), "Borrar nota"],
      ["Esc", "Salir de focus"],
    ],
  ],
]

export function Cheatsheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* Mismo estilo "página" que el dialog de nota en Repaso: sin header en caja, sin X,
          padding generoso — acá va más contenido sin sentirse listado. */}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:w-4xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-12 sm:py-10">
          <div className="mx-auto max-w-md">
            <div className="mb-8 flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold tracking-tight text-pretty">
                Atajos de teclado
              </DialogTitle>
              <Kbd>esc</Kbd>
            </div>
            <div className="flex flex-col gap-7">
              {GROUPS.map(([group, items]) => (
                <div key={group}>
                  <p className="eyebrow mb-3">{group}</p>
                  <div className="flex flex-col gap-2.5">
                    {items.map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-fg-secondary">{label}</span>
                        <Kbd>{key}</Kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
