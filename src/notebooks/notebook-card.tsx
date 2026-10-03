import { NotebookIcon } from "@/notebooks/notebook-icon"
import { NotebookRowActions } from "@/notebooks/notebook-row-actions"
import { STATUS, STATUS_DOT } from "@/notebooks/notebook-status"
import { Card } from "@/core/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { relativeDay } from "@/core/lib/day"
import type { NotebookRow } from "@/core/types/database"

// Fondos/bordes translúcidos (no tokens sólidos): el hover de la card es bg-muted y un chip
// sólido se aplasta contra él. Las métricas en 0 no se muestran (ruido).
const CHIP =
  "inline-flex h-6 items-center rounded-md bg-foreground/[0.07] px-2 text-xs leading-none text-fg-secondary"

function Metric({ value, one, many }: { value: number; one: string; many: string }) {
  return (
    <span className="mono-dim inline-flex h-6 items-center rounded-md border border-foreground/12 px-2 leading-none">
      <b className="mr-1 font-medium text-foreground">{value}</b>
      {value === 1 ? one : many}
    </span>
  )
}

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
  return (
    <Card
      data-active={active}
      onClick={() => onOpen(c)}
      className="group cursor-pointer gap-3.5 p-5 ring-0 transition-colors hover:bg-muted data-[active=true]:bg-muted"
    >
      <div className="flex items-start gap-3">
        <NotebookIcon icon={c.icon} className="size-8 shrink-0 text-muted-foreground" />
        <span className="line-clamp-2 min-h-[2.6em] flex-1 text-base leading-snug font-medium text-pretty">
          {c.name}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`mt-2 size-2 shrink-0 rounded-full ${STATUS_DOT[c.status]}`} />
          </TooltipTrigger>
          <TooltipContent className="capitalize">{STATUS[c.status][0]}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex min-h-6 flex-wrap gap-1.5">
        {c.source && <span className={CHIP}>{c.source}</span>}
        {c.area && <span className={CHIP}>{c.area}</span>}
        {c.notes > 0 && <Metric value={c.notes} one="nota" many="notas" />}
        {c.rounds > 0 && <Metric value={c.rounds} one="ronda" many="rondas" />}
      </div>
      <div className="mt-auto flex items-center justify-between">
        <span className="mono-dim">{relativeDay(c.started_at)}</span>
        <NotebookRowActions notebook={c} onEdit={() => onEdit(c)} onDelete={() => onDelete(c.id)} />
      </div>
    </Card>
  )
}
