import { NotebookIcon } from "@/notebooks/notebook-icon"
import { NotebookRowActions } from "@/notebooks/notebook-row-actions"
import { STATUS, STATUS_DOT } from "@/notebooks/notebook-status"
import { Card } from "@/core/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { relativeDay } from "@/core/lib/day"
import type { NotebookRow } from "@/core/types/database"

// Sin pills: la jerarquía sale de luminancia (ADR 0023). Meta en texto plano, estado como dot en
// la esquina (label en tooltip), fecha = última lectura (no started_at). Acciones al hover — con opacity, no display,
// para que el footer no salte; siempre visibles en touch.
export function NotebookCard({
  notebook: c,
  active,
  onOpen,
  onEdit,
  onDelete,
}: {
  notebook: NotebookRow
  active: boolean
  onOpen: (notebook: NotebookRow) => void
  onEdit: (notebook: NotebookRow) => void
  onDelete: (id: string) => void
}) {
  const meta = [c.source, c.area].filter(Boolean).join(" · ")

  return (
    <Card
      data-active={active}
      onClick={() => onOpen(c)}
      className="group cursor-pointer gap-5 p-5 transition-colors duration-150 ease-out hover:bg-sunken dark:hover:bg-muted data-[active=true]:outline-3 data-[active=true]:outline-offset-2 data-[active=true]:outline-ring/50"
    >
      <div className="flex items-start gap-3">
        <NotebookIcon icon={c.icon} className="size-8" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base leading-snug font-medium text-pretty">{c.name}</h3>
          {meta && <p className="mt-1 truncate text-sm text-muted-foreground">{meta}</p>}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`mt-2 size-2 shrink-0 rounded-full ${STATUS_DOT[c.status]}`} />
          </TooltipTrigger>
          <TooltipContent className="capitalize">{STATUS[c.status].label}</TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-auto flex h-7 items-center gap-2 text-xs whitespace-nowrap text-muted-foreground">
        <span className="font-mono">
          {c.notes > 0 ? `${c.notes} ${c.notes === 1 ? "nota" : "notas"}` : "vacío"}
        </span>
        <span className="ml-auto min-w-0 truncate font-mono" title="Última lectura">
          {c.last_read ? relativeDay(c.last_read) : "sin leer"}
        </span>
        <div className="opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 focus-within:opacity-100 has-data-[state=open]:opacity-100 pointer-coarse:opacity-100">
          <NotebookRowActions
            notebook={c}
            onEdit={() => onEdit(c)}
            onDelete={() => onDelete(c.id)}
          />
        </div>
      </div>
    </Card>
  )
}
