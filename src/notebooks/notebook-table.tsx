import { ChevronRight } from "lucide-react"
import { NotebookEmpty } from "@/notebooks/notebook-empty"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { NotebookRowActions } from "@/notebooks/notebook-row-actions"
import { STATUS } from "@/notebooks/notebook-status"
import { Badge } from "@/core/ui/badge"
import { Card } from "@/core/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table"
import { dayOf } from "@/core/lib/day"
import type { NotebookRow } from "@/core/types/database"

// La vacía es la columna de acciones; el chevron va pegado al nombre en la misma celda.
const HEADERS = [
  "Notebook",
  "Fuente",
  "Área",
  "Estado",
  "Rondas",
  "Notas",
  "Inicio",
  "Últ. repaso",
  "",
]

function fmt(d: string | null | undefined) {
  return d ? d.slice(0, 10) : "—"
}

export function NotebookTable({
  rows,
  selected,
  filtering,
  onOpen,
  onEdit,
  onDelete,
}: {
  rows: NotebookRow[]
  selected: number
  filtering: boolean
  onOpen: (notebook: NotebookRow) => void
  onEdit: (notebook: NotebookRow) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="p-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {HEADERS.map((h, i) => (
              <TableHead
                key={h}
                className={`eyebrow px-3 py-3 ${i >= 5 ? "text-right" : ""} ${
                  i === 0 ? "sticky left-0 z-10 bg-card" : ""
                }`}
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c, i) => (
            <TableRow
              key={c.id}
              data-active={i === selected}
              className="group cursor-pointer data-[active=true]:bg-muted"
              onClick={() => onOpen(c)}
            >
              <TableCell className="sticky left-0 z-10 max-w-80 bg-card px-3 py-3 font-medium whitespace-normal group-hover:bg-muted/50 group-data-[active=true]:bg-muted/50">
                <span className="flex items-start gap-2">
                  <ChevronRight size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <NotebookIcon icon={c.icon} className="mt-0.5 shrink-0 text-muted-foreground" />
                  {c.name}
                </span>
              </TableCell>
              <TableCell
                className="max-w-30 truncate px-3 py-3 text-muted-foreground"
                title={c.source ?? undefined}
              >
                {c.source || "—"}
              </TableCell>
              <TableCell
                className="max-w-30 truncate px-3 py-3 text-muted-foreground"
                title={c.area ?? undefined}
              >
                {c.area || "—"}
              </TableCell>
              <TableCell className="px-3 py-3">
                <Badge variant={STATUS[c.status][1]}>{STATUS[c.status][0]}</Badge>
              </TableCell>
              <TableCell className="mono px-3 py-3">{c.rounds}</TableCell>
              <TableCell className="mono px-3 py-3 text-right">{c.notes}</TableCell>
              <TableCell className="mono-dim px-3 py-3 text-right">{fmt(c.started_at)}</TableCell>
              <TableCell className="mono-dim px-3 py-3 text-right">{dayOf(c.last_read)}</TableCell>
              <TableCell className="px-3 py-3 text-right">
                <NotebookRowActions
                  notebook={c}
                  onEdit={() => onEdit(c)}
                  onDelete={() => onDelete(c.id)}
                />
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={HEADERS.length}>
                <NotebookEmpty filtering={filtering} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  )
}
