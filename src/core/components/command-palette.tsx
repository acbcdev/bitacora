import { useState } from "react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/core/ui/command"
import { Kbd } from "@/core/ui/kbd"

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

  // Un grupo por `group`, en el orden en que aparecen en `actions`.
  const groups = new Map<string, Action[]>()
  for (const a of actions) groups.set(a.group, [...(groups.get(a.group) ?? []), a])

  return (
    <CommandDialog
      open
      onOpenChange={(open) => !open && onClose()}
      className="w-[560px] max-w-[92vw] sm:max-w-[560px]"
    >
      {/* El `CommandDialog` del registry no monta el root de cmdk, solo el diálogo. */}
      <Command>
        <CommandInput
          value={q}
          onValueChange={setQ}
          placeholder="Buscar acción, curso o nota…"
          endContent={<Kbd>esc</Kbd>}
        />
        <CommandList className="max-h-[380px]">
          <CommandEmpty>Sin resultados para “{q}”.</CommandEmpty>
          {[...groups].map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((a, i) => (
                <CommandItem
                  key={group + a.label + i}
                  // El value es lo que cmdk filtra: incluye el grupo para que "notas" matchee las
                  // notas aunque no aparezca en ningún label.
                  value={`${group} ${a.label}`}
                  onSelect={() => {
                    onClose()
                    a.run()
                  }}
                >
                  <span className="text-muted-foreground">{a.icon}</span>
                  <span className="flex-1 truncate">{a.label}</span>
                  {a.kbd && <CommandShortcut>{a.kbd}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
