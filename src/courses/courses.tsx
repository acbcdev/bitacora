import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
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
import { Progress } from "@/core/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/core/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { useCourses, useCourseProgress, useDeleteCourse } from "@/courses/courses.api"
import { useAllNoteRefs } from "@/notes/notes.api"
import { dayOf, useReadStats } from "@/core/lib/stats"
import type { Course, CourseStatus } from "@/core/types/database"

const STATUS: Record<CourseStatus, [string, "brand" | "warning" | "outline"]> = {
  active: ["activo", "brand"],
  paused: ["pausado", "warning"],
  done: ["hecho", "outline"],
}

type Sort = "recientes" | "nombre" | "progreso" | "inicio"

// Curso al 100%: la barra pierde el acento de marca (regla visual del DS).
const INDICATOR_DONE = "[&>[data-slot=progress-indicator]]:bg-muted-foreground"

// Las dos vacías son la columna del chevron y la de acciones.
const HEADERS = ["", "Curso", "Estado", "Progreso", "Notas", "Inicio", "Últ. repaso", ""]

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

  const [view, setView] = useState<"tabla" | "tarjetas">("tabla")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<CourseStatus | "todos">("todos")
  const [sort, setSort] = useState<Sort>("recientes")
  const [editing, setEditing] = useState<Course | null | "new">(params.get("new") ? "new" : null)

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

  const pct = (id: string) => {
    const p = progress?.get(id)
    return p?.total ? Math.round((p.read / p.total) * 100) : 0
  }

  const rows = courses
    .filter(
      (c) =>
        (status === "todos" || c.status === status) &&
        c.name.toLowerCase().includes(q.toLowerCase()),
    )
    .toSorted((a, b) => {
      if (sort === "nombre") return a.name.localeCompare(b.name)
      if (sort === "progreso") return pct(b.id) - pct(a.id)
      if (sort === "inicio") return (b.started_at ?? "").localeCompare(a.started_at ?? "")
      return (lastRead.get(b.id) ?? "").localeCompare(lastRead.get(a.id) ?? "")
    })

  function close() {
    setEditing(null)
    if (params.get("new")) setParams({}, { replace: true })
  }

  return (
    <div className={embed ? "fade-in" : "fade-in mx-auto max-w-shell px-8 pt-9 pb-16"}>
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
        <InputGroup className="w-55 bg-card">
          <InputGroupAddon>
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar curso…"
          />
        </InputGroup>

        <Pill icon={<Filter size={13} />} value={status} onChange={setStatus}>
          <option value="todos">Estado: todos</option>
          <option value="active">Activos</option>
          <option value="paused">Pausados</option>
          <option value="done">Hechos</option>
        </Pill>
        <Pill icon={<ArrowUpDown size={13} />} value={sort} onChange={setSort}>
          <option value="recientes">Últ. repaso</option>
          <option value="nombre">Nombre</option>
          <option value="progreso">Progreso</option>
          <option value="inicio">Inicio</option>
        </Pill>

        {/* `v &&` porque radix manda "" al deseleccionar: siempre queda una vista elegida. */}
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={view}
          onValueChange={(v) => v && setView(v as typeof view)}
          className="ml-auto"
        >
          <ToggleGroupItem value="tabla" aria-label="tabla">
            <Rows3 />
          </ToggleGroupItem>
          <ToggleGroupItem value="tarjetas" aria-label="tarjetas">
            <LayoutGrid />
          </ToggleGroupItem>
        </ToggleGroup>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus />
          Nuevo curso
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : view === "tabla" ? (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {HEADERS.map((h, i) => (
                  <TableHead key={i} className={`eyebrow px-3 py-3 ${i >= 4 ? "text-right" : ""}`}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/course/${c.id}`)}
                >
                  <TableCell className="w-7 px-3 py-3 text-muted-foreground">
                    <ChevronRight size={14} />
                  </TableCell>
                  <TableCell className="px-3 py-3 font-medium">
                    <span className="flex items-center gap-2">
                      <CourseIcon icon={c.icon} className="text-muted-foreground" />
                      {c.name}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    <Badge variant={STATUS[c.status][1]}>{STATUS[c.status][0]}</Badge>
                  </TableCell>
                  <TableCell className="w-45 px-3 py-3">
                    <CourseProgress
                      read={progress?.get(c.id)?.read ?? 0}
                      total={progress?.get(c.id)?.total ?? 0}
                    />
                  </TableCell>
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
              <div className="mb-2.5">
                <CourseProgress
                  read={progress?.get(c.id)?.read ?? 0}
                  total={progress?.get(c.id)?.total ?? 0}
                />
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

// Progreso derivado (ADR 0003): notas leídas / total. Al 100% pierde el acento.
function CourseProgress({ read, total }: { read: number; total: number }) {
  const pct = total ? Math.round((read / total) * 100) : 0
  return (
    <div className="flex items-center gap-2.5">
      <Progress
        value={pct}
        aria-label={`Progreso: ${read} de ${total} notas leídas`}
        className={pct === 100 ? `flex-1 ${INDICATOR_DONE}` : "flex-1"}
      />
      <span className="mono">
        {read}/{total}
      </span>
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
  value,
  onChange,
  children,
}: {
  icon: React.ReactNode
  value: T
  onChange: (v: T) => void
  children: React.ReactNode
}) {
  return (
    // El icono va absoluto sobre el select y este le deja lugar con `pl-8`: `NativeSelect` no
    // acepta hijos aparte de las opciones.
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 z-10 -translate-y-1/2 text-muted-foreground">
        {icon}
      </span>
      <NativeSelect
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="[&>select]:pl-8"
      >
        {children}
      </NativeSelect>
    </div>
  )
}
