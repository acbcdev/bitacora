import { NotebookIcon } from "@/notebooks/notebook-icon"
import { NotebookRowActions } from "@/notebooks/notebook-row-actions"
import { STATUS, STATUS_DOT } from "@/notebooks/notebook-status"
import { Card } from "@/core/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { relativeDay } from "@/core/lib/day"
import type { NotebookRow } from "@/core/types/database"

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
      className="group cursor-pointer gap-0 p-6 transition-colors hover:bg-muted data-[active=true]:bg-muted"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex min-h-12 items-center gap-2 text-base leading-6 font-medium text-pretty">
          <NotebookIcon icon={c.icon} className="size-7 shrink-0 text-muted-foreground" />
          <span className="line-clamp-2">{c.name}</span>
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_DOT[c.status]}`} />
          </TooltipTrigger>
          <TooltipContent className="capitalize">{STATUS[c.status][0]}</TooltipContent>
        </Tooltip>
      </div>
      <div className="mb-3 flex items-center gap-1.5 text-fg-secondary">
        <span className="truncate">{c.source || "—"}</span>
        <span className="text-muted-foreground">·</span>
        <span className="truncate">{c.area || "—"}</span>
      </div>
      <div className="mb-3 flex items-center gap-1.5">
        <span className="eyebrow">Rondas</span>
        <span className="mono">{c.rounds}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="mono-dim">{relativeDay(c.started_at)}</span>
        <NotebookRowActions notebook={c} onEdit={() => onEdit(c)} onDelete={() => onDelete(c.id)} />
      </div>
    </Card>
  )
}
