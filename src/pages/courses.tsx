import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowUpDown,
  ChevronRight,
  Filter,
  LayoutGrid,
  Pencil,
  Plus,
  Rows3,
  Search,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import {
  useCourses,
  useCourseProgress,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
} from "@/lib/courses"
import { useAllNoteRefs } from "@/lib/notes"
import { dayOf, useReadStats } from "@/lib/stats"
import type { Course, CourseStatus } from "@/types/database"

const STATUS: Record<CourseStatus, [string, "brand" | "warning" | "outline"]> = {
  active: ["activo", "brand"],
  paused: ["pausado", "warning"],
  done: ["hecho", "outline"],
}

type Sort = "recientes" | "nombre" | "progreso" | "inicio"

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
        (status === "todos" || c.status === status) && c.name.toLowerCase().includes(q.toLowerCase()),
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
            embed
              ? "text-xl font-semibold tracking-tight"
              : "text-2xl font-semibold tracking-tight"
          }
        >
          Cursos
        </h1>
        <span className="mono-dim">
          {rows.length} de {courses.length}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex h-8 w-[220px] items-center gap-2 rounded-lg border border-input bg-card px-2.5">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar curso…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

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

        <div className="ml-auto flex overflow-hidden rounded-lg border border-input">
          {(["tabla", "tarjetas"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-label={v}
              aria-pressed={view === v}
              className="icon-btn rounded-none border-0 aria-pressed:bg-muted aria-pressed:text-foreground"
            >
              {v === "tabla" ? <Rows3 /> : <LayoutGrid />}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus />
          Nuevo curso
        </Button>
      </div>

      {isLoading ? null : view === "tabla" ? (
        <div className="panel overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-input">
                {["", "Curso", "Estado", "Progreso", "Notas", "Inicio", "Últ. repaso", ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`eyebrow px-3 py-3 ${i >= 4 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="group row-link border-b"
                  onClick={() => navigate(`/course/${c.id}`)}
                >
                  <td className="w-7 px-3 py-3 text-muted-foreground">
                    <ChevronRight size={14} />
                  </td>
                  <td className="px-3 py-3 text-sm font-medium">{c.name}</td>
                  <td className="px-3 py-3">
                    <Badge variant={STATUS[c.status][1]}>{STATUS[c.status][0]}</Badge>
                  </td>
                  <td className="w-[180px] px-3 py-3">
                    <Progress read={progress?.get(c.id)?.read ?? 0} total={progress?.get(c.id)?.total ?? 0} />
                  </td>
                  <td className="mono px-3 py-3 text-right">{progress?.get(c.id)?.total ?? 0}</td>
                  <td className="mono-dim px-3 py-3 text-right">{fmt(c.started_at)}</td>
                  <td className="mono-dim px-3 py-3 text-right">{dayOf(lastRead.get(c.id))}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <RowActions
                      course={c}
                      onEdit={() => setEditing(c)}
                      onDelete={() => del.mutate(c.id)}
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-7 text-center text-sm text-muted-foreground">
                    {courses.length === 0
                      ? "Sin cursos. Creá el primero."
                      : "Sin cursos que coincidan. Ajustá los filtros."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {rows.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/course/${c.id}`)}
              className="group panel cursor-pointer p-5 transition-colors hover:bg-muted"
            >
              <div className="mb-3.5 flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-pretty">{c.name}</span>
                <Badge variant={STATUS[c.status][1]}>{STATUS[c.status][0]}</Badge>
              </div>
              <div className="mb-2.5">
                <Progress
                  read={progress?.get(c.id)?.read ?? 0}
                  total={progress?.get(c.id)?.total ?? 0}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="mono-dim">{fmt(c.started_at)}</span>
                <span className="mono-dim group-hover:hidden">
                  últ. {dayOf(lastRead.get(c.id))}
                </span>
                <RowActions
                  course={c}
                  onEdit={() => setEditing(c)}
                  onDelete={() => del.mutate(c.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <CourseForm course={editing === "new" ? null : editing} onClose={close} />}
    </div>
  )
}

// Progreso derivado (ADR 0003): notas leídas / total. Al 100% pierde el acento.
function Progress({ read, total }: { read: number; total: number }) {
  const pct = total ? Math.round((read / total) * 100) : 0
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={pct === 100 ? "h-full bg-muted-foreground" : "h-full bg-brand"}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="mono">
        {read}/{total}
      </span>
    </div>
  )
}

// Editar / borrar aparecen al hover — la fila entera navega al curso.
function RowActions({
  course,
  onEdit,
  onDelete,
}: {
  course: Course
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <span
      className="inline-flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <button className="icon-btn" onClick={onEdit} aria-label={`Editar ${course.name}`}>
        <Pencil size={14} />
      </button>
      <button
        className="icon-btn hover:text-destructive"
        aria-label={`Borrar ${course.name}`}
        onClick={() => confirm(`¿Borrar "${course.name}"?`) && onDelete()}
      >
        <Trash2 size={14} />
      </button>
    </span>
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
    <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-card px-2">
      <span className="text-muted-foreground">{icon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="cursor-pointer bg-transparent text-xs text-fg-secondary outline-none"
      >
        {children}
      </select>
    </label>
  )
}

function CourseForm({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const create = useCreateCourse()
  const update = useUpdateCourse()

  const [name, setName] = useState(course?.name ?? "")
  const [status, setStatus] = useState<CourseStatus>(course?.status ?? "active")
  const [startedAt, setStartedAt] = useState(course?.started_at?.slice(0, 10) ?? "")
  const [finishedAt, setFinishedAt] = useState(course?.finished_at?.slice(0, 10) ?? "")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // Pasar a "done" sin fecha → setear finished_at hoy.
    const finished =
      status === "done" && !finishedAt ? new Date().toISOString().slice(0, 10) : finishedAt
    const input = { name, status, started_at: startedAt || null, finished_at: finished || null }
    const done = { onSuccess: onClose }
    if (course) update.mutate({ id: course.id, ...input }, done)
    else create.mutate(input, done)
  }

  const field = "flex flex-col gap-1.5"

  return (
    <Modal onClose={onClose} className="w-[420px] max-w-[92vw]">
      <form onSubmit={submit}>
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">{course ? "Editar curso" : "Nuevo curso"}</h2>
        </div>
        <div className="flex flex-col gap-5 px-8 py-6">
          <label className={field}>
            <span className="eyebrow">Nombre</span>
            <Input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Compiladores desde cero"
              className="h-10"
            />
          </label>
          <label className={field}>
            <span className="eyebrow">Estado</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CourseStatus)}
              className="h-10 rounded-lg border border-input bg-card px-2.5 text-base outline-none"
            >
              <option value="active">activo</option>
              <option value="paused">pausado</option>
              <option value="done">hecho</option>
            </select>
          </label>
          <div className="flex gap-4">
            <label className={field}>
              <span className="eyebrow">Inicio</span>
              <Input
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="h-10"
              />
            </label>
            <label className={field}>
              <span className="eyebrow">Fin</span>
              <Input
                type="date"
                value={finishedAt}
                onChange={(e) => setFinishedAt(e.target.value)}
                className="h-10"
              />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-8 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">{course ? "Guardar" : "Crear curso"}</Button>
        </div>
      </form>
    </Modal>
  )
}
