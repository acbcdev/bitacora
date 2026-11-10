import { useState, type ReactNode } from "react"
import { Check, ChevronDown, Target } from "lucide-react"
import { cn } from "@/core/lib/utils"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import type { Habit } from "@/core/types/database"

// Tarjetas plegadas: 2 filas a la vista (6 = 3 columnas en desktop), el resto detrás de una fila
// fantasma que dice QUÉ hay escondido (íconos + nombres), no solo cuántos.
// ponytail: 6 fijo = 2 filas solo con 3 columnas; en mobile son 6 filas. Si molesta, medir
// columnas con ResizeObserver y usar cols*2.
const VISIBLE = 6

export function HabitFold<T extends { h: Habit; state: { met: boolean } }>({
  items,
  grid,
  render,
  arrived,
}: {
  items: T[]
  grid: string
  // hidden = está plegado (fuera de vista): el tile no debe participar de view transitions.
  render: (item: T, hidden: boolean) => ReactNode
  // Hábito recién cumplido que acaba de caer acá: la fila lo anuncia en vez de la lista de nombres.
  arrived?: string | null
}) {
  const [open, setOpen] = useState(false)
  const rest = items.slice(VISIBLE)
  const landed = rest.find(({ h }) => h.id === arrived)?.h
  // Lo cumplido plegado se ve SIEMPRE, no solo en el aviso de llegada: avatares cumplidos al
  // frente en verde, el conteo aparte y los nombres solo de lo que falta.
  const stack = rest.toSorted((a, b) => Number(b.state.met) - Number(a.state.met)).slice(0, 4)
  const doneCount = rest.filter((i) => i.state.met).length
  const pendingNames = rest.filter((i) => !i.state.met).map(({ h }) => h.name)

  return (
    <>
      <div className={grid}>{items.slice(0, VISIBLE).map((i) => render(i, false))}</div>
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
              <div className={cn(grid, "pt-5")}>{rest.map((i) => render(i, !open))}</div>
            </div>
          </div>

          {/* Fantasma: transparente en reposo, fondo solo en hover — hit target ancho sin peso. */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="group mt-2 flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            {!open && (
              <span className="flex shrink-0 -space-x-1.5">
                {stack.map(({ h, state }) => (
                  <span
                    key={h.id}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full bg-muted text-fg-secondary ring-2 ring-background transition-colors group-hover:ring-card",
                      // Aterriza: entra grande y se asienta — el ojo encuentra el que acaba de caer.
                      h.id === arrived && "z-10 animate-in duration-300 ease-out zoom-in-125",
                    )}
                  >
                    <NotebookIcon
                      icon={h.icon}
                      fallback={Target}
                      // En el ícono y no en el span: el tinte propio del hábito pisaría el heredado.
                      className={cn("size-3", state.met && "text-signal")}
                    />
                  </span>
                ))}
              </span>
            )}
            <span className="text-sm font-medium text-foreground">
              {open ? "mostrar menos" : `${rest.length} más`}
            </span>
            {!open &&
              (landed ? (
                <span
                  key={landed.id}
                  className="inline-flex min-w-0 animate-in items-center gap-1.5 rounded-full bg-signal/10 px-2 py-0.5 font-mono text-xs text-signal duration-200 ease-out fade-in zoom-in-95"
                >
                  <Check size={12} strokeWidth={3} className="shrink-0" />
                  <span className="truncate">{landed.name} cumplido</span>
                </span>
              ) : (
                <>
                  {doneCount > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-signal tabular-nums">
                      <Check size={12} strokeWidth={3} />
                      {doneCount} cumplido{doneCount > 1 && "s"}
                    </span>
                  )}
                  <span className="mono-dim min-w-0 truncate">{pendingNames.join(" · ")}</span>
                </>
              ))}
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
