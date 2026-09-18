import { ArrowUpDown, Filter, LayoutGrid, Plus, Rows3, Search } from "lucide-react"
import { Button } from "@/core/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/core/ui/input-group"
import { NativeSelect } from "@/core/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/core/ui/toggle-group"
import type { Sort } from "@/notebooks/notebook-filters"
import type { NotebookStatus } from "@/core/types/database"

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
  status: NotebookStatus | "todos"
  onStatus: (v: NotebookStatus | "todos") => void
  sort: Sort
  onSort: (v: Sort) => void
  view: "tabla" | "tarjetas"
  onView: (v: "tabla" | "tarjetas") => void
  onNew: () => void
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <InputGroup className="min-w-0 flex-1 bg-card sm:w-55 sm:flex-none">
        <InputGroupAddon>
          <Search className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          ref={searchRef}
          value={q}
          onChange={(e) => onQ(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder="Buscar notebook…"
        />
      </InputGroup>

      <Pill
        icon={<Filter size={13} />}
        active={status !== "todos"}
        value={status}
        onChange={onStatus}
      >
        <option value="todos">Estado: todos</option>
        <option value="active">Activos</option>
        <option value="paused">Pausados</option>
        <option value="done">Hechos</option>
      </Pill>
      <Pill
        icon={<ArrowUpDown size={13} />}
        active={sort !== "recientes"}
        value={sort}
        onChange={onSort}
      >
        <option value="recientes">Recientes</option>
        <option value="nombre">Nombre</option>
        <option value="rondas">Rondas</option>
        <option value="inicio">Inicio</option>
      </Pill>

      {/* `v &&` porque radix manda "" al deseleccionar: siempre queda una vista elegida. */}
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={view}
        onValueChange={(v) => v && onView(v as typeof view)}
        className="ml-auto max-md:hidden"
      >
        {/* Tabla no entra en un viewport angosto (columnas se pisan) — en mobile ni el toggle
            se muestra: siempre cards. */}
        <ToggleGroupItem value="tarjetas" aria-label="tarjetas">
          <LayoutGrid />
        </ToggleGroupItem>
        <ToggleGroupItem value="tabla" aria-label="tabla">
          <Rows3 />
        </ToggleGroupItem>
      </ToggleGroup>
      <Button
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

function Pill<T extends string>({
  icon,
  active,
  value,
  onChange,
  children,
}: {
  icon: React.ReactNode
  active?: boolean
  value: T
  onChange: (v: T) => void
  children: React.ReactNode
}) {
  return (
    // El icono va absoluto sobre el select y este le deja lugar con `pl-8`: `NativeSelect` no
    // acepta hijos aparte de las opciones.
    <div className="relative">
      <span
        className={`pointer-events-none absolute top-1/2 left-2.5 z-10 -translate-y-1/2 ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      {/* En mobile el select queda del ancho del icono: texto transparente y sin chevron. Sigue
          siendo un select nativo, así que tocarlo abre el picker del sistema; el icono en
          `text-primary` avisa que el filtro no está en su valor por defecto. */}
      <NativeSelect
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="[&>select]:pl-8 max-md:w-8 max-md:[&>svg]:hidden max-md:[&>select]:pr-0 max-md:[&>select]:text-transparent"
      >
        {children}
      </NativeSelect>
    </div>
  )
}
