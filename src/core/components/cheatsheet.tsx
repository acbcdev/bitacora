import { alt, mod } from "@/core/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/core/ui/dialog"
import { Kbd } from "@/core/ui/kbd"

const GROUPS: [string, [string, string][]][] = [
  [
    "Global",
    [
      [mod("K"), "Command palette"],
      [mod("/"), "Este cheatsheet"],
      [mod(","), "Ajustes"],
      ["N", "Nuevo notebook"],
      ["G luego H", "Ir a Hoy"],
      ["G luego 1-9", "Ir al notebook N del sidebar (9 = el último)"],
      ["Esc", "Cerrar / salir"],
    ],
  ],
  [
    "Repaso",
    [
      ["← / →", "Volver / siguiente, sin contar"],
      ["Enter", "Abrir la nota / marcar leída"],
      [mod("Enter"), "Expandir la nota"],
      ["H luego 1-9", "Registrar el hábito N de la tira"],
    ],
  ],
  [
    "Notebooks",
    [
      ["J / K  ·  ← / →", "Moverse por la lista"],
      ["Enter", "Abrir el notebook seleccionado"],
      ["E", "Editar el notebook seleccionado"],
      ["Delete", "Borrar el notebook seleccionado"],
      ["/", "Buscar"],
    ],
  ],
  [
    "Nota",
    [
      [mod("Shift+F"), "Focus mode"],
      [mod("Shift+Enter"), "Plegar / desplegar el Desplegable del cursor"],
      [`${alt("J")} / ${alt("K")}`, "Moverse entre notas del notebook"],
      ["/", "Buscar en el índice"],
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
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold tracking-tight text-pretty">
                Atajos de teclado
              </DialogTitle>
              <Kbd>esc</Kbd>
            </div>
            {/* columns, no grid: balancea las alturas solo y un grupo nunca se parte en dos. */}
            <div className="gap-x-12 sm:columns-2">
              {GROUPS.map(([group, items]) => (
                <div key={group} className="break-inside-avoid pb-7 last:pb-0">
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
