import { useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"
import { Kbd } from "@/components/ui/kbd"
import { Modal } from "@/components/ui/modal"

export type Action = {
  group: string
  label: string
  icon?: React.ReactNode
  kbd?: string
  run: () => void
}

// ⌘K: navegar, acciones y salto directo a cualquier curso o nota. Es la búsqueda del MVP —
// filtra sobre lo que ya está en caché de TanStack Query, sin FTS ni scoring (CONTEXT: datos chicos).
export function CommandPalette({ onClose, actions }: { onClose: () => void; actions: Action[] }) {
  const [q, setQ] = useState("")
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const needle = q.toLowerCase()
  const hits = actions.filter(
    (a) => a.label.toLowerCase().includes(needle) || a.group.toLowerCase().includes(needle),
  )
  const current = hits[sel]

  // Mantener visible la fila seleccionada al moverse con flechas.
  useEffect(() => {
    listRef.current?.querySelector('[data-sel="true"]')?.scrollIntoView({ block: "nearest" })
  }, [sel])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, hits.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === "Enter" && current) {
      e.preventDefault()
      onClose()
      current.run()
    }
  }

  let lastGroup: string | null = null

  return (
    <Modal onClose={onClose} className="mt-[14vh] mb-auto w-[560px] max-w-[92vw]">
      <div className="flex items-center gap-2.5 border-b px-4 py-3.5">
        <Search className="text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setSel(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Buscar acción, curso o nota…"
          className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <Kbd>esc</Kbd>
      </div>

      <div ref={listRef} className="max-h-[380px] overflow-y-auto py-1.5">
        {hits.length === 0 && (
          <p className="px-4 py-5 text-sm text-muted-foreground">Sin resultados para “{q}”.</p>
        )}
        {hits.map((a, i) => {
          const header = a.group !== lastGroup ? a.group : null
          lastGroup = a.group
          return (
            <div key={a.group + a.label + i}>
              {header && <p className="eyebrow px-4 pt-2.5 pb-1">{header}</p>}
              <button
                data-sel={sel === i}
                onClick={() => {
                  onClose()
                  a.run()
                }}
                onMouseMove={() => setSel(i)}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm data-[sel=true]:bg-muted"
              >
                <span className="text-muted-foreground">{a.icon}</span>
                <span className="flex-1 truncate">{a.label}</span>
                {a.kbd && <Kbd>{a.kbd}</Kbd>}
              </button>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
