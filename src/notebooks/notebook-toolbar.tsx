import { LayoutGrid, Plus, Rows3, Search } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
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
const label = <T,>(opts: [T, string][], v: T) => opts.find(([k]) => k === v)![1]

const CHIP =
  "flex h-8 cursor-pointer items-center gap-2 rounded-full bg-card px-3 text-sm shadow-card ring-1 ring-border hover:ring-border-strong aria-expanded:ring-border-strong"

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
      <Menu value={status} onChange={onStatus} opts={STATUS_OPTS}>
        <button className={CHIP}>
          <span className="text-muted-foreground max-md:hidden">Estado</span>
          {status !== "todos" && <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />}
          <span className="font-medium">{label(STATUS_OPTS, status)}</span>
        </button>
      </Menu>
      <Menu value={sort} onChange={onSort} opts={SORT_OPTS}>
        <button className={CHIP}>
          <span className="text-muted-foreground max-md:hidden">Orden</span>
          <span className="font-medium">{label(SORT_OPTS, sort)}</span>
        </button>
      </Menu>

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

function Menu<T extends string>({
  value,
  onChange,
  opts,
  children,
}: {
  value: T
  onChange: (v: T) => void
  opts: [T, string][]
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
          {opts.map(([k, l]) => (
            <DropdownMenuRadioItem key={k} value={k}>
              {l}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
