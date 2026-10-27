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
import { Kbd, KbdGroup } from "@/core/ui/kbd"
import { filterActions, type Action } from "./command-palette-utils"

export type { Action }

// ⌘K: navegar, acciones y salto directo a cualquier notebook o nota. Es la búsqueda del MVP —
// filtra sobre lo que ya está en caché de TanStack Query, sin FTS ni scoring (CONTEXT: datos chicos).
export function CommandPalette({ onClose, actions }: { onClose: () => void; actions: Action[] }) {
  const [q, setQ] = useState("")
  const hits = filterActions(actions, q)

  // Un grupo por `group`, en el orden en que aparecen en `actions`.
  const groups = new Map<string, Action[]>()
  for (const a of hits) groups.set(a.group, [...(groups.get(a.group) ?? []), a])

  return (
    <CommandDialog
      open
      onOpenChange={(open) => !open && onClose()}
      className="w-[660px] max-w-[92vw] bg-popover/70 backdrop-blur-2xl backdrop-saturate-150 sm:max-w-[660px]"
    >
      {/* El `CommandDialog` del registry no monta el root de cmdk, solo el diálogo. */}
      <Command shouldFilter={false} className="bg-transparent p-0">
        <CommandInput
          value={q}
          onValueChange={setQ}
          placeholder="Buscar acción, notebook o nota…"
        />
        <CommandList className="max-h-[420px] p-1.5">
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
                  className="h-10 gap-3 px-3 data-selected:bg-foreground/9"
                >
                  <span className="flex w-5 shrink-0 justify-center text-muted-foreground">
                    {a.icon}
                  </span>
                  <span className="flex-1 truncate">
                    {a.label}
                    {a.hint && <span className="text-xs text-muted-foreground"> · {a.hint}</span>}
                  </span>
                  {a.kbd && (
                    // "G H" es secuencia (G, después H): se muestra como chord G → H.
                    <CommandShortcut className="tracking-normal">
                      <KbdGroup>
                        {a.kbd.split(" ").map((k, j) => (
                          <span key={k} className="flex items-center gap-1">
                            {j > 0 && "→"}
                            <Kbd className="border border-foreground/18 bg-transparent group-data-selected/command-item:text-foreground">
                              {k}
                            </Kbd>
                          </span>
                        ))}
                      </KbdGroup>
                    </CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
        <div className="flex items-center justify-between gap-3 border-t border-foreground/6 px-3.5 py-2.5 text-2xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              abrir
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Kbd>esc</Kbd>
            cerrar
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}
