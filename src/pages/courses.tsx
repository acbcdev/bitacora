import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  useCourses,
  useCourseProgress,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
} from "@/lib/courses"
import { useNotes, useCreateNote } from "@/lib/notes"
import type { Course, CourseStatus } from "@/types/database"

const STATUS_LABEL: Record<CourseStatus, string> = { active: "activo", paused: "pausado", done: "hecho" }
const STATUS_STYLE: Record<CourseStatus, string> = {
  active: "bg-foreground text-background",
  paused: "bg-muted text-muted-foreground",
  done: "border text-muted-foreground",
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—"
}

export function Courses() {
  const { data: courses = [], isLoading } = useCourses()
  const { data: progress } = useCourseProgress()
  const del = useDeleteCourse()
  const [editing, setEditing] = useState<Course | null | "new">(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Cursos</h1>
        <button
          onClick={() => setEditing("new")}
          className="rounded bg-foreground px-3 py-1.5 text-sm text-background"
        >
          Nuevo curso
        </button>
      </div>

      {isLoading ? null : courses.length === 0 ? (
        <p className="text-muted-foreground">Sin cursos. Creá el primero.</p>
      ) : (
        <ul className="divide-y">
          {courses.map((c) => {
            const p = progress?.get(c.id)
            return (
              <li key={c.id} className="py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="flex-1 text-left"
                  >
                    <span className="font-medium">{c.name}</span>
                  </button>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                  <span className="w-12 text-right text-sm text-muted-foreground">
                    {p ? `${p.read}/${p.total}` : "0/0"}
                  </span>
                  <button onClick={() => setEditing(c)} className="text-sm text-muted-foreground hover:underline">
                    editar
                  </button>
                  <button
                    onClick={() => confirm(`¿Borrar "${c.name}"?`) && del.mutate(c.id)}
                    className="text-sm text-destructive hover:underline"
                  >
                    borrar
                  </button>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {fmt(c.started_at)} → {fmt(c.finished_at)}
                </div>
                {expanded === c.id && <CourseNotes courseId={c.id} />}
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <CourseForm course={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function CourseNotes({ courseId }: { courseId: string }) {
  const { data: notes = [] } = useNotes(courseId)
  const create = useCreateNote()
  const navigate = useNavigate()

  return (
    <div className="mt-2 ml-2 border-l pl-4">
      <ul className="space-y-1">
        {notes.map((n) => (
          <li key={n.id}>
            <Link to={`/note/${n.id}`} className="text-sm hover:underline">
              {n.title || "(sin título)"}
            </Link>
          </li>
        ))}
        {notes.length === 0 && <li className="text-sm text-muted-foreground">Sin notas.</li>}
      </ul>
      <button
        onClick={() => create.mutate(courseId, { onSuccess: (id) => navigate(`/note/${id}`) })}
        className="mt-2 text-sm text-muted-foreground hover:underline"
      >
        + nueva nota
      </button>
    </div>
  )
}

// Form de crear/editar en <dialog> nativo (foco + Esc gratis, sin lib).
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
    const finished = status === "done" && !finishedAt ? new Date().toISOString().slice(0, 10) : finishedAt
    const input = {
      name,
      status,
      started_at: startedAt || null,
      finished_at: finished || null,
    }
    const done = { onSuccess: onClose }
    if (course) update.mutate({ id: course.id, ...input }, done)
    else create.mutate(input, done)
  }

  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal()
      }}
      onClose={onClose}
      className="m-auto rounded-lg border bg-background p-6 text-foreground backdrop:bg-black/40"
    >
      <form onSubmit={submit} className="flex w-72 flex-col gap-3">
        <h2 className="font-semibold">{course ? "Editar curso" : "Nuevo curso"}</h2>
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="rounded border bg-transparent px-3 py-2"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CourseStatus)}
          className="rounded border bg-transparent px-3 py-2"
        >
          <option value="active">activo</option>
          <option value="paused">pausado</option>
          <option value="done">hecho</option>
        </select>
        <label className="text-sm text-muted-foreground">
          Inicio
          <input
            type="date"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            className="mt-1 w-full rounded border bg-transparent px-3 py-2"
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Fin
          <input
            type="date"
            value={finishedAt}
            onChange={(e) => setFinishedAt(e.target.value)}
            className="mt-1 w-full rounded border bg-transparent px-3 py-2"
          />
        </label>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm">
            Cancelar
          </button>
          <button type="submit" className="rounded bg-foreground px-3 py-1.5 text-sm text-background">
            Guardar
          </button>
        </div>
      </form>
    </dialog>
  )
}
