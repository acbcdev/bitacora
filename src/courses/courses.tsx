import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import {
  ArrowUpDown,
  ChevronRight,
  Filter,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Rows3,
  Search,
  Trash2,
} from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { CourseIcon } from "@/courses/course-icon"
import { CourseForm } from "@/courses/course-form"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/core/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { useIsMobile } from "@/core/hooks/use-mobile"
import { useCourses, useCourseProgress, useDeleteCourse } from "@/courses/courses.api"
import { useAllNoteRefs } from "@/notes/notes.api"
import { dayOf, useReadStats } from "@/core/lib/stats"
import type { Course, CourseStatus } from "@/core/types/database"

const STATUS: Record<CourseStatus, [string, "brand" | "warning" | "outline"]> = {
  active: ["activo", "brand"],
  paused: ["pausado", "warning"],
  done: ["hecho", "outline"],
}

type Sort = "recientes" | "nombre" | "rondas" | "inicio"

// La vacía es la columna de acciones; el chevron va pegado al nombre en la misma celda.
const HEADERS = [
  "Curso",
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

// Pantalla Cursos (screen 2) como database view del diseño: buscar, filtrar por estado, ordenar,
// y alternar tabla / tarjetas. Todo en cliente — 59 cursos, no hace falta nada del servidor.
export function Courses({ embed }: { embed?: boolean }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data: courses = [], isLoading } = useCourses()
  const { data: progress } = useCourseProgress()
  const { data: noteRefs = [] } = useAllNoteRefs()
  const { data: stats } = useReadStats()
  const del = useDeleteCourse()
  const isMobile = useIsMobile()

  const [view, setView] = useState<"tabla" | "tarjetas">("tarjetas")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<CourseStatus | "todos">("todos")
  const [sort, setSort] = useState<Sort>("recientes")
  const [editing, setEditing] = useState<Course | null | "new">(params.get("new") ? "new" : null)

  useHotkeys("n", () => setEditing("new"), { preventDefault: true })

  // Últ. repaso por curso: el read_at más nuevo de cualquiera de sus notas (ADR 0003).
  const lastRead = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of noteRefs) {
      const last = stats?.byNote.get(n.id)?.last
      if (!n.course_id || !last) continue
      const prev = m.get(n.course_id)
      if (!prev || last > prev) m.set(n.course_id, last)
    }
    return m
  }, [noteRefs, stats])

  // Rondas completas por curso: la nota MENOS repasada marca el pie del grupo — si todas
  // llevan al menos 2 repasos, el curso lleva 2 rondas completas (sin ronda a medias).
  const rounds = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of noteRefs) {
      if (!n.course_id) continue
      const count = stats?.byNote.get(n.id)?.count ?? 0
      const prev = m.get(n.course_id)
      m.set(n.course_id, prev === undefined ? count : Math.min(prev, count))
    }
    return m
  }, [noteRefs, stats])

  const rows = courses
    .filter(
      (c) =>
        (status === "todos" || c.status === status) &&
        c.name.toLowerCase().includes(q.toLowerCase()),
    )
    .toSorted((a, b) => {
      if (sort === "nombre") return a.name.localeCompare(b.name)
      if (sort === "rondas") return (rounds.get(b.id) ?? 0) - (rounds.get(a.id) ?? 0)
      if (sort === "inicio") return (b.started_at ?? "").localeCompare(a.started_at ?? "")
      return (lastRead.get(b.id) ?? "").localeCompare(lastRead.get(a.id) ?? "")
    })

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
          Cursos
        </h1>
        <span className="mono-dim">
          {rows.length} de {courses.length}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-0 flex-1 bg-card sm:w-55 sm:flex-none">
          <InputGroupAddon>
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar curso…"
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
          <option value="recientes">Últ. repaso</option>
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
          size="sm"
          onClick={() => setEditing("new")}
          aria-label="Nuevo curso"
          className="max-md:ml-auto max-md:size-8 max-md:p-0"
        >
          <Plus />
          <span className="max-md:hidden">Nuevo curso</span>
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
                    key={i}
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
              {rows.map((c) => (
                <TableRow
                  key={c.id}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/course/${c.id}`)}
                >
                  <TableCell className="sticky left-0 z-10 max-w-80 bg-card px-3 py-3 font-medium whitespace-normal group-hover:bg-muted/50">
                    <span className="flex items-start gap-2">
                      <ChevronRight size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <CourseIcon icon={c.icon} className="mt-0.5 shrink-0 text-muted-foreground" />
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
                  <TableCell className="mono px-3 py-3">{rounds.get(c.id) ?? 0}</TableCell>
                  <TableCell className="mono px-3 py-3 text-right">
                    {progress?.get(c.id)?.total ?? 0}
                  </TableCell>
                  <TableCell className="mono-dim px-3 py-3 text-right">
                    {fmt(c.started_at)}
                  </TableCell>
                  <TableCell className="mono-dim px-3 py-3 text-right">
                    {dayOf(lastRead.get(c.id))}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right">
                    <RowActions
                      course={c}
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
                          {courses.length === 0 ? "Sin cursos." : "Sin cursos que coincidan."}
                        </EmptyTitle>
                        <EmptyDescription>
                          {courses.length === 0 ? "Creá el primero." : "Ajustá los filtros."}
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {rows.map((c) => (
            <Card
              key={c.id}
              onClick={() => navigate(`/course/${c.id}`)}
              className="group cursor-pointer gap-0 p-5 transition-colors hover:bg-muted"
            >
              <div className="mb-3.5 flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium text-pretty">
                  <CourseIcon icon={c.icon} className="text-muted-foreground" />
                  {c.name}
                </span>
                <Badge variant={STATUS[c.status][1]}>{STATUS[c.status][0]}</Badge>
              </div>
              <div className="mb-2.5 flex items-center gap-1.5">
                <span className="eyebrow">Rondas</span>
                <span className="mono">{rounds.get(c.id) ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mono-dim">{fmt(c.started_at)}</span>
                <span className="mono-dim">últ. {dayOf(lastRead.get(c.id))}</span>
                <RowActions
                  course={c}
                  onEdit={() => setEditing(c)}
                  onDelete={() => del.mutate(c.id)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <CourseForm course={editing === "new" ? null : editing} onClose={close} />}
    </div>
  )
}

// Editar / borrar en un menú — la fila entera navega al curso.
function RowActions({
  course,
  onEdit,
  onDelete,
}: {
  course: Course
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    // El menú se portalea pero React igual propaga el click por el árbol, así que el
    // stopPropagation va en los dos lados: si no, elegir una acción navega al curso.
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${course.name}`}>
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Acciones</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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
        what={course.name}
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
