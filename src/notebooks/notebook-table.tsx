import { NotebookEmpty } from "@/notebooks/notebook-empty"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { NotebookRowActions } from "@/notebooks/notebook-row-actions"
import { STATUS, STATUS_DOT } from "@/notebooks/notebook-status"
import { Card } from "@/core/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { relativeDay } from "@/core/lib/day"
import type { NotebookRow } from "@/core/types/database"

// Una línea por notebook, alto fijo (nombres largos truncan, no crecen). Fuera: Rondas (es el MÍNIMO
// entre notas → casi siempre 0), Inicio (el orden ya lo cubre) y Estado como columna: el dot va
// tras el nombre y sólo para activo/pausado — hecho es el estado por defecto y no se marca.
// table-fixed + anchos en los headers: la columna del nombre se queda con el resto.
const HEADERS = [
  { label: "Notebook", cls: "" },
  { label: "Área", cls: "w-56" },
  { label: "Notas", cls: "w-18 text-right" },
  { label: "Repaso", cls: "w-30 text-right" },
  { label: "", cls: "w-14" },
]

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
    <Card className="py-2">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {HEADERS.map((h) => (
              <TableHead
                key={h.label}
                className={`px-6 py-3.5 text-xs font-normal text-muted-foreground first:pr-3 ${h.cls}`}
              >
                {h.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c, i) => (
            <TableRow
              key={c.id}
              data-active={i === selected}
              className="group h-14 cursor-pointer border-0 hover:bg-muted/60 data-[active=true]:bg-muted/60"
              onClick={() => onOpen(c)}
            >
              <TableCell className="px-6">
                <span className="flex min-w-0 items-center gap-3">
                  <NotebookIcon icon={c.icon} className="text-muted-foreground" />
                  <span className="truncate font-medium">{c.name}</span>
                  {c.status !== "done" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[c.status]}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="capitalize">
                        {STATUS[c.status].label}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {c.source && <span className="mono-dim shrink-0">{c.source}</span>}
                </span>
              </TableCell>
              <TableCell className="px-6">
                {c.area ? (
                  <span
                    className="inline-block max-w-full truncate rounded-md bg-foreground/[0.07] px-2.5 py-1 align-middle text-xs text-fg-secondary"
                    title={c.area}
                  >
                    {c.area}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">—</span>
                )}
              </TableCell>
              <TableCell className="mono px-6 text-right">{c.notes}</TableCell>
              <TableCell
                className={`px-6 text-right text-xs ${c.last_read ? "text-fg-secondary" : "text-muted-foreground/50"}`}
              >
                {c.last_read ? relativeDay(c.last_read) : "nunca"}
              </TableCell>
              <TableCell className="px-3 text-right">
                {/* Visible en hover, cursor de teclado o foco (Tab llega al botón aunque esté oculto). */}
                <span className="opacity-0 group-hover:opacity-100 group-data-[active=true]:opacity-100 focus-within:opacity-100">
                  <NotebookRowActions
                    notebook={c}
                    onEdit={() => onEdit(c)}
                    onDelete={() => onDelete(c.id)}
                  />
                </span>
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
