import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  LayoutGrid,
  ListFilter,
  Plus,
  Rows3,
  Search,
  X,
} from "lucide-react"
import { cn } from "@/core/lib/utils"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/core/ui/select"
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
  ["recientes", "Fecha"],
  ["nombre", "Nombre"],
  ["rondas", "Rondas"],
]

// Qué significa la flecha en cada sort: [dirección natural, invertida].
const DIR_LABEL: Record<Sort, [string, string]> = {
  recientes: ["Leídos hace poco primero", "Sin leer primero"],
  nombre: ["A → Z", "Z → A"],
  rondas: ["Más rondas primero", "Menos rondas primero"],
}

export function NotebookToolbar({
  q,
  onQ,
  searchRef,
  onSearchKey,
  status,
  onStatus,
  sort,
  onSort,
  reverse,
  onReverse,
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
  reverse: boolean
  onReverse: () => void
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

      {/* Icono en vez de "Campo": el × sólo aparece fuera de default y resetea sin abrir el menú. */}
      <FilterChip
        name="Estado"
        icon={
          status === "todos" ? (
            <ListFilter />
          ) : (
            <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
          )
        }
        value={status}
        opts={STATUS_OPTS}
        onChange={onStatus}
        dirty={status !== "todos"}
        onClear={() => onStatus("todos")}
      />
      {/* El icono de Orden ES el toggle de dirección. changeSort ya vuelve reverse a false. */}
      <FilterChip
        name="Orden"
        lead={<DirToggle sort={sort} reverse={reverse} onReverse={onReverse} />}
        value={sort}
        opts={SORT_OPTS}
        onChange={onSort}
        dirty={sort !== "recientes" || reverse}
        onClear={() => onSort("recientes")}
      />

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

const ICON_BTN =
  "flex h-8 cursor-pointer items-center text-muted-foreground hover:text-foreground [&_svg]:size-3.5"

// Ancho fijo a propósito (sin layout shift): el valor apila todas las opciones en una celda con sólo
// la actual visible, y el chevron queda invisible bajo el × en vez de desmontarse.
function FilterChip<T extends string>({
  name,
  icon,
  lead,
  value,
  opts,
  onChange,
  dirty,
  onClear,
}: {
  name: string
  icon?: React.ReactNode
  lead?: React.ReactNode
  value: T
  opts: [T, string][]
  onChange: (v: T) => void
  dirty: boolean
  onClear: () => void
}) {
  return (
    <div
      className={cn(
        "relative flex h-8 items-center rounded-full bg-card pr-1 shadow-card ring-1 ring-border hover:ring-border-strong has-aria-expanded:ring-border-strong",
        lead ? "pl-2.5" : "pl-1",
        dirty && "ring-border-strong",
      )}
    >
      {lead}
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        {/* El último svg es el chevron propio del SelectTrigger: se oculta y va el nuestro. */}
        <SelectTrigger
          aria-label={name}
          title={name}
          className="h-8 w-auto cursor-pointer gap-1.5 rounded-full border-0 bg-transparent px-1.5 shadow-none dark:bg-transparent dark:hover:bg-transparent [&>svg:last-child]:hidden"
        >
          {/* Slot fijo: el dot (6px) y el icono (14px) ocupan lo mismo. */}
          {icon && (
            <span className="flex size-3.5 items-center justify-center text-muted-foreground [&_svg]:size-3.5">
              {icon}
            </span>
          )}
          <span className="grid text-start font-medium">
            {opts.map(([k, l]) => (
              <span key={k} className={cn("col-start-1 row-start-1", k !== value && "invisible")}>
                {l}
              </span>
            ))}
          </span>
          <ChevronDown className={cn("size-3.5 opacity-60", dirty && "invisible")} />
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="min-w-40">
          {opts.map(([k, l]) => (
            <SelectItem key={k} value={k}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {dirty && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Quitar ${name}`}
          className={cn(ICON_BTN, "absolute inset-y-0 right-1.5 w-5.5 justify-center rounded-full")}
        >
          <X />
        </button>
      )}
    </div>
  )
}

// Los dos iconos apilados en la misma celda; el swap es opacity + scale (sólo compositor).
const SWAP =
  "col-start-1 row-start-1 transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-none"
const shown = (on: boolean) => (on ? "opacity-100 scale-100" : "opacity-0 scale-90")

function DirToggle({
  sort,
  reverse,
  onReverse,
}: {
  sort: Sort
  reverse: boolean
  onReverse: () => void
}) {
  const l = DIR_LABEL[sort][reverse ? 1 : 0]
  return (
    <button
      type="button"
      onClick={onReverse}
      title={l}
      aria-label={`Invertir orden: ${l}`}
      className={cn(ICON_BTN, "grid")}
    >
      <ArrowDownWideNarrow className={cn(SWAP, shown(!reverse))} />
      <ArrowUpNarrowWide className={cn(SWAP, shown(reverse))} />
    </button>
  )
}
