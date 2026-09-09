import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowUpDown,
  ChevronRight,
  Filter,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Rows3,
  Search,
  Trash2,
} from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { NotebookForm } from "@/notebooks/notebook-form"
import { togglePinnedNotebook, usePinnedNotebookIds } from "@/notebooks/pinned-notebooks"
import { TableSkeleton } from "@/core/components/skeletons"
import { Badge } from "@/core/ui/badge"
import { Button } from "@/core/ui/button"
import { Card } from "@/core/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/core/ui/input-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { NativeSelect } from "@/core/ui/native-select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/core/ui/pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/core/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import { PAGE_SIZE, useNotebooksPage, useDeleteNotebook } from "@/notebooks/notebooks.api"
import { dayOf, relativeDay } from "@/core/lib/day"
import type { Notebook, NotebookStatus } from "@/core/types/database"

const STATUS: Record<NotebookStatus, [string, "brand" | "warning" | "outline"]> = {
  active: ["activo", "brand"],
  paused: ["pausado", "warning"],
  done: ["hecho", "outline"],
}

const STATUS_DOT: Record<NotebookStatus, string> = {
  active: "bg-brand",
  paused: "bg-warning",
  done: "bg-muted-foreground",
}

type Sort = "recientes" | "nombre" | "rondas" | "inicio"

// El buscador dispara una query por cambio: sin debounce sería una RPC por tecla.
const SEARCH_DEBOUNCE = 300

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

// Pantalla Notebooks (screen 2) como database view del diseño: buscar, filtrar por estado, ordenar,
// y alternar tabla / tarjetas. Búsqueda, filtro, orden y paginado los resuelve la RPC
// `notebooks_page` (migración 0006) — el cliente sólo guarda el estado de los controles.
export function Notebooks({ embed }: { embed?: boolean }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const del = useDeleteNotebook()
  const isMobile = useIsMobile()

  const [view, setView] = useState<"tabla" | "tarjetas">("tarjetas")
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [status, setStatus] = useState<NotebookStatus | "todos">("todos")
  const [sort, setSort] = useState<Sort>("recientes")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Notebook | null | "new">(params.get("new") ? "new" : null)
  const [selected, setSelected] = useState(0)
  const [confirmingDelete, setConfirmingDelete] = useState<Notebook | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE)
    return () => clearTimeout(t)
  }, [q])

  const { data, isLoading } = useNotebooksPage({ q: debouncedQ, status, sort, page })
  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1)
  // Distingue "todavía no creaste ningún notebook" de "los filtros no matchean nada": con paginado
  // en server no hay una lista completa en cliente contra la cual comparar.
  const filtering = !!debouncedQ || status !== "todos"

  useSafeHotkeys("n", () => setEditing("new"), { preventDefault: true })
  // "slash", no "/": la lib matchea por e.code (ver comentario de mod+slash en app.tsx).
  useSafeHotkeys("slash", () => searchRef.current?.focus(), {
    preventDefault: true,
    enabled: !embed,
  })

  // Cambiar filtro/orden vuelve a la página 1: la 3 puede no existir en el resultado filtrado.
  // La selección de teclado también se resetea — apuntaría a un notebook que ya no está en la lista.
  useEffect(() => {
    setSelected(0)
    setPage(1)
  }, [debouncedQ, status, sort])
  useEffect(() => setSelected(0), [page])

  // Borrar el último notebook de la última página la deja vacía: retroceder en vez de mostrar nada.
  useEffect(() => {
    if (page > pages) setPage(pages)
  }, [page, pages])

  // Nav por teclado sobre la página actual: J/K (+ Left/Right) mueven la selección, Enter abre
  // (mismo destino que el click), E edita, Delete/Backspace borra (misma confirmación de siempre).
  // Pasarse del borde salta de página. enabled: !embed — dentro de Repaso esta lista es
  // secundaria, J/K/Enter ya los usa la cola.
  useSafeHotkeys(
    "j,left",
    () => {
      if (selected === 0 && page > 1) return setPage(page - 1)
      setSelected((i) => Math.max(i - 1, 0))
    },
    { preventDefault: true, enabled: !embed },
    [selected, page],
  )
  useSafeHotkeys(
    "k,right",
    () => {
      if (selected === rows.length - 1 && page < pages) return setPage(page + 1)
      setSelected((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)))
    },
    { preventDefault: true, enabled: !embed },
    [selected, rows.length, page, pages],
  )
  useSafeHotkeys(
    "enter",
    () => rows[selected] && navigate(`/notebook/${rows[selected].id}`),
    { preventDefault: true, enabled: !embed },
    [rows, selected, navigate],
  )
  useSafeHotkeys(
    "e",
    () => rows[selected] && setEditing(rows[selected]),
    { preventDefault: true, enabled: !embed },
    [rows, selected],
  )
  useSafeHotkeys(
    "backspace,delete",
    () => rows[selected] && setConfirmingDelete(rows[selected]),
    { preventDefault: true, enabled: !embed },
    [rows, selected],
  )

  function close() {
    setEditing(null)
    if (params.get("new")) setParams({}, { replace: true })
  }

  return (
    <div className={embed ? "fade-in" : "fade-in mx-auto max-w-shell px-4 pt-9 pb-16 sm:px-8"}>
      <div className="mb-6 flex items-baseline gap-3">
        <h1
          className={
            embed ? "text-xl font-semibold tracking-tight" : "text-2xl font-semibold tracking-tight"
          }
        >
          Notebooks
        </h1>
        <span className="mono-dim">
          {total} {total === 1 ? "notebook" : "notebooks"}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-0 flex-1 bg-card sm:w-55 sm:flex-none">
          <InputGroupAddon>
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Enter dispara la búsqueda sin esperar el debounce; el timer pendiente después
              // setea el mismo valor y no hace nada.
              if (e.key === "Enter") return setDebouncedQ(q)
              if (e.key !== "Escape") return
              if (q) setQ("")
              searchRef.current?.blur()
            }}
            placeholder="Buscar notebook…"
          />
        </InputGroup>

        <Pill
          icon={<Filter size={13} />}
          active={status !== "todos"}
          value={status}
          onChange={setStatus}
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
          onChange={setSort}
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
          onValueChange={(v) => v && setView(v as typeof view)}
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
          onClick={() => setEditing("new")}
          aria-label="Nuevo notebook"
          className="max-md:ml-auto max-md:size-8 max-md:p-0"
        >
          <Plus />
          <span className="max-md:hidden">Nuevo notebook</span>
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : view === "tabla" && !isMobile ? (
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
                  onClick={() => navigate(`/notebook/${c.id}`)}
                >
                  <TableCell className="sticky left-0 z-10 max-w-80 bg-card px-3 py-3 font-medium whitespace-normal group-hover:bg-muted/50 group-data-[active=true]:bg-muted/50">
                    <span className="flex items-start gap-2">
                      <ChevronRight size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <NotebookIcon
                        icon={c.icon}
                        className="mt-0.5 shrink-0 text-muted-foreground"
                      />
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
                  <TableCell className="mono-dim px-3 py-3 text-right">
                    {fmt(c.started_at)}
                  </TableCell>
                  <TableCell className="mono-dim px-3 py-3 text-right">
                    {dayOf(c.last_read)}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right">
                    <RowActions
                      notebook={c}
                      onEdit={() => setEditing(c)}
                      onDelete={() => del.mutate(c.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={HEADERS.length}>
                    <Empty className="px-3 py-7">
                      <EmptyHeader>
                        <EmptyTitle>
                          {filtering ? "Sin notebooks que coincidan." : "Sin notebooks."}
                        </EmptyTitle>
                        <EmptyDescription>
                          {filtering ? "Ajustá los filtros." : "Creá el primero."}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c, i) => (
            <Card
              key={c.id}
              data-active={i === selected}
              onClick={() => navigate(`/notebook/${c.id}`)}
              className="group cursor-pointer gap-0 p-6 transition-colors hover:bg-muted data-[active=true]:bg-muted"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="flex min-h-12 items-center gap-2 text-base leading-6 font-medium text-pretty">
                  <NotebookIcon icon={c.icon} className="size-7 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2">{c.name}</span>
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_DOT[c.status]}`}
                    />
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
                <RowActions
                  notebook={c}
                  onEdit={() => setEditing(c)}
                  onDelete={() => del.mutate(c.id)}
                />
              </div>
            </Card>
          ))}
          {rows.length === 0 && (
            <Empty className="col-span-full py-7">
              <EmptyHeader>
                <EmptyTitle>
                  {filtering ? "Sin notebooks que coincidan." : "Sin notebooks."}
                </EmptyTitle>
                <EmptyDescription>
                  {filtering ? "Ajustá los filtros." : "Creá el primero."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      )}

      {/* ponytail: sin elipsis — a 59 notebooks son 3 páginas y entran todas. Si `pages` crece,
          `PaginationEllipsis` ya está importable desde el mismo módulo. */}
      {pages > 1 && (
        <Pagination className="mt-8">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                text="Anterior"
                href="#"
                aria-disabled={page === 1}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
                onClick={(e) => {
                  e.preventDefault()
                  setPage((p) => Math.max(p - 1, 1))
                }}
              />
            </PaginationItem>
            {Array.from({ length: pages }, (_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  href="#"
                  isActive={page === i + 1}
                  onClick={(e) => {
                    e.preventDefault()
                    setPage(i + 1)
                  }}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                text="Siguiente"
                href="#"
                aria-disabled={page === pages}
                className={page === pages ? "pointer-events-none opacity-50" : ""}
                onClick={(e) => {
                  e.preventDefault()
                  setPage((p) => Math.min(p + 1, pages))
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {editing && <NotebookForm notebook={editing === "new" ? null : editing} onClose={close} />}

      {/* Borrar por teclado (Delete/Backspace sobre la fila seleccionada) — separado del
          ConfirmDelete de RowActions, que ya cubre el flujo de mouse. */}
      <ConfirmDelete
        open={confirmingDelete !== null}
        onOpenChange={(open) => !open && setConfirmingDelete(null)}
        what={confirmingDelete?.name ?? ""}
        onConfirm={() => {
          if (confirmingDelete) del.mutate(confirmingDelete.id)
        }}
      />
    </div>
  )
}

// Editar / borrar en un menú — la fila entera navega al notebook.
function RowActions({
  notebook,
  onEdit,
  onDelete,
}: {
  notebook: Notebook
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const pinned = usePinnedNotebookIds().includes(notebook.id)

  return (
    // El menú se portalea pero React igual propaga el click por el árbol, así que el
    // stopPropagation va en los dos lados: si no, elegir una acción navega al notebook.
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${notebook.name}`}>
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Acciones</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => togglePinnedNotebook(notebook.id)}>
          {pinned ? <PinOff /> : <Pin />}
          {pinned ? "Desfijar" : "Fijar"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
          <Trash2 />
          Borrar
        </DropdownMenuItem>
      </DropdownMenuContent>

      <ConfirmDelete
        open={confirming}
        onOpenChange={setConfirming}
        what={notebook.name}
        onConfirm={onDelete}
      />
    </DropdownMenu>
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
