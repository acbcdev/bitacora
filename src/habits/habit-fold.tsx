import { useState, type ReactNode } from "react"
import { ChevronDown, Target } from "lucide-react"
import { cn } from "@/core/lib/utils"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import type { Habit } from "@/core/types/database"

// Tarjetas plegadas: 2 filas a la vista (6 = 3 columnas en desktop), el resto detrás de una fila
// fantasma que dice QUÉ hay escondido (íconos + nombres), no solo cuántos.
// ponytail: 6 fijo = 2 filas solo con 3 columnas; en mobile son 6 filas. Si molesta, medir
// columnas con ResizeObserver y usar cols*2.
const VISIBLE = 6

export function HabitFold<T extends { h: Habit }>({
  items,
  grid,
  render,
}: {
  items: T[]
  grid: string
  render: (item: T) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const rest = items.slice(VISIBLE)

  return (
    <>
      <div className={grid}>{items.slice(0, VISIBLE).map(render)}</div>
      {rest.length > 0 && (
        <>
          {/* grid-rows 0fr→1fr anima el alto real sin medirlo; inert saca lo plegado del tab. */}
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
              open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
            inert={!open}
          >
            <div className="min-h-0 overflow-hidden">
              <div className={cn(grid, "pt-3")}>{rest.map(render)}</div>
            </div>
          </div>

          {/* Fantasma: transparente en reposo, fondo solo en hover — hit target ancho sin peso. */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-2 flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {!open && (
              // ring = fondo de página: separa los íconos superpuestos sin halo.
              <span className="flex shrink-0 -space-x-1.5">
                {rest.slice(0, 4).map(({ h }) => (
                  <span
                    key={h.id}
                    className="flex size-6 items-center justify-center rounded-full bg-muted text-fg-secondary ring-2 ring-background"
                  >
                    <NotebookIcon icon={h.icon} fallback={Target} className="size-3" />
                  </span>
                ))}
              </span>
            )}
            <span className="text-sm font-medium text-foreground">
              {open ? "mostrar menos" : `${rest.length} más`}
            </span>
            {!open && (
              <span className="mono-dim min-w-0 truncate">
                {rest.map(({ h }) => h.name).join(" · ")}
              </span>
            )}
            <ChevronDown
              className={cn(
                "ml-auto size-4 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </button>
        </>
      )}
    </>
  )
}
