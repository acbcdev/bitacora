import { LayoutGrid, Plus, Rows3, Search } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select"
import { ViewPill } from "@/core/components/view-pill"
import { STATUS_DOT } from "@/notebooks/notebook-status"
import type { Sort } from "@/notebooks/notebook-filters"
import type { NotebookStatus } from "@/core/types/database"

type Status = NotebookStatus | "todos"
type View = "tabla" | "tarjetas"

const STATUS_OPTS: [Status, string][] = [
  ["todos", "Todos"],
  ["active", "Activos"],
  ["paused", "Pausados"],
  ["done", "Hechos"],
]
const SORT_OPTS: [Sort, string][] = [
  ["recientes", "Recientes"],
  ["nombre", "Nombre"],
  ["rondas", "Rondas"],
  ["inicio", "Inicio"],
]

// border-0 + [&>svg]:hidden: pisa el borde y el chevron del SelectTrigger (el chip no lleva chevron).
const CHIP =
  "h-8 w-auto cursor-pointer gap-2 rounded-full border-0 bg-card px-3 shadow-card ring-1 ring-border hover:ring-border-strong aria-expanded:ring-border-strong dark:bg-card dark:hover:bg-card [&>svg]:hidden"

export function NotebookToolbar({
  q,
  onQ,
  searchRef,
  onSearchKey,
  status,
  onStatus,
  sort,
  onSort,
  view,
  onView,
  onNew,
}: {
  q: string
  onQ: (v: string) => void
  searchRef: React.RefObject<HTMLInputElement | null>
  onSearchKey: (e: React.KeyboardEvent<HTMLInputElement>) => void
  status: Status
  onStatus: (v: Status) => void
  sort: Sort
  onSort: (v: Sort) => void
  view: View
  onView: (v: View) => void
  onNew: () => void
}) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <label className="group flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-3 shadow-card ring-1 ring-border focus-within:ring-border-strong sm:w-60 sm:flex-none">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => onQ(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder="Buscar notebook…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {!q && <Kbd className="group-focus-within:hidden max-md:hidden">/</Kbd>}
      </label>

      {/* "Campo valor": el nombre del campo dim ya dice qué abre el chip — sin icono ni chevron.
          En mobile queda sólo el valor. */}
      <Chip name="Estado" value={status} onChange={onStatus} opts={STATUS_OPTS}>
        {status !== "todos" && <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />}
      </Chip>
      <Chip name="Orden" value={sort} onChange={onSort} opts={SORT_OPTS} />

      {/* Tabla no entra en un viewport angosto (columnas se pisan) — en mobile ni el toggle
          se muestra: siempre cards. */}
      <ViewPill
        value={view}
        onChange={onView}
        options={{ tarjetas: <LayoutGrid />, tabla: <Rows3 /> }}
        className="ml-auto max-md:hidden"
      />
      {/* Secondary como el "Nuevo" de Hábitos: en Hoy el único primario es "Siguiente". */}
      <Button
        variant="secondary"
        onClick={onNew}
        aria-label="Nuevo notebook"
        className="max-md:ml-auto max-md:size-8 max-md:p-0"
      >
        <Plus />
        <span className="max-md:hidden">Nuevo notebook</span>
      </Button>
    </div>
  )
}

function Chip<T extends string>({
  name,
  value,
  onChange,
  opts,
  children,
}: {
  name: string
  value: T
  onChange: (v: T) => void
  opts: [T, string][]
  children?: React.ReactNode
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger aria-label={name} className={CHIP}>
        <span className="text-muted-foreground max-md:hidden">{name}</span>
        {children}
        <SelectValue className="font-medium" />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="min-w-40">
        {opts.map(([k, l]) => (
          <SelectItem key={k} value={k}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
