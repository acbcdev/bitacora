import { Kbd } from "@/components/ui/kbd"
import { Modal } from "@/components/ui/modal"

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
    <Modal onClose={onClose} className="w-[440px] max-w-[92vw]">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-base font-semibold">Atajos de teclado</h2>
        <Kbd>esc</Kbd>
      </div>
      <div className="flex flex-col gap-3.5 px-5 pt-3 pb-5">
        {GROUPS.map(([group, items]) => (
          <div key={group}>
            <p className="eyebrow mb-2">{group}</p>
            {items.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between border-b py-1.5 text-sm">
                <span className="text-fg-secondary">{label}</span>
                <Kbd>{key}</Kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  )
}
