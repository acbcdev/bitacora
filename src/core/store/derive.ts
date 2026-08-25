import type { Course, CourseRow, CourseStatus } from "@/core/types/database"
import type { HabitLogRow, NoteRef, ReadRow, Snapshot } from "@/core/store/types"

// Todo lo derivado vive acá: funciones puras `Snapshot → hecho del dominio`. Sin React, sin
// adapter, sin red.
//
// Antes esto estaba repartido en tres estrategias incompatibles (la RPC `courses_page` en SQL,
// `useReadStats` en JS, `useRetention` con un join + JS). Ahora hay un solo hogar y lo usan los
// dos adapters — que es lo que hace que "modo local" y "modo Supabase" signifiquen lo mismo en
// vez de parecerse.
//
// El snapshot ya trae sólo filas vivas (el adapter filtró `deleted_at`), así que acá NO se vuelve
// a chequear: la regla vive en un lado solo.

export type CoursesQuery = {
  q: string
  status: CourseStatus | "todos"
  sort: "recientes" | "nombre" | "rondas" | "inicio"
  page: number
  pageSize: number
}

const STATUS_ORDER: Record<CourseStatus, number> = { active: 0, paused: 1, done: 2 }

// Orden estable de la app: active → paused → done, después más nuevo primero. Lo usan el sidebar,
// la command palette y el form de curso.
export function liveCourses(snap: Snapshot): Course[] {
  return snap.courses.toSorted(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.created_at.localeCompare(a.created_at),
  )
}

// Las notas de un curso, en orden de `position`. Las flashcards no entran: no se listan en el
// curso (ADR 0010).
export function courseNotes(snap: Snapshot, courseId: string): NoteRef[] {
  return snap.notes
    .filter((n) => n.course_id === courseId && n.kind === "note")
    .toSorted((a, b) => a.position - b.position)
}

// Índice de todas las notas para la command palette y el "últ. repaso" por curso.
export function noteRefs(snap: Snapshot): NoteRef[] {
  return snap.notes.filter((n) => n.kind === "note").toSorted((a, b) => a.position - b.position)
}

// Cuántas veces se leyó cada nota y cuándo fue la última.
function readsByNote(reads: ReadRow[]) {
  const map = new Map<string, { count: number; last: string | null }>()
  for (const r of reads) {
    const prev = map.get(r.note_id)
    map.set(r.note_id, {
      count: (prev?.count ?? 0) + 1,
      last: !prev?.last || r.read_at > prev.last ? r.read_at : prev.last,
    })
  }
  return map
}

const SORTS: Record<CoursesQuery["sort"], (a: CourseRow, b: CourseRow) => number> = {
  nombre: (a, b) => a.name.localeCompare(b.name),
  rondas: (a, b) => b.rounds - a.rounds,
  // 'recientes' e 'inicio' son el mismo criterio desde la migración 0009: para los 57 cursos
  // importados `created_at` es sólo la hora del batch, y `started_at` la fecha real.
  inicio: byStartedAt,
  recientes: byStartedAt,
}

function byStartedAt(a: CourseRow, b: CourseRow) {
  if (a.started_at === b.started_at) return 0
  if (!a.started_at) return 1 // nulls last
  if (!b.started_at) return -1
  return b.started_at.localeCompare(a.started_at)
}

// La página de la pantalla Cursos. Reemplaza a la RPC `courses_page` (migraciones 0006-0009), que
// queda en la DB sin que nadie la llame.
//
// `rounds` es el MÍNIMO de repasos entre las notas del curso — "cuántas vueltas completas le
// diste", no el total. Un curso con una nota sin leer tiene 0 rondas por más que las otras 24
// estén leídas 5 veces. Sale así de la RPC (`min(coalesce(rd.cnt, 0))`) y se mantiene.
export function coursesPage(
  snap: Snapshot,
  query: CoursesQuery,
): { rows: CourseRow[]; total: number } {
  const perNote = readsByNote(snap.reads)

  // Sólo notas `kind = 'note'` con curso: las flashcards no cuentan para el progreso del curso
  // (ADR 0010) y una nota huérfana no tiene a quién sumarle.
  const stats = new Map<string, { notes: number; rounds: number; last_read: string | null }>()
  for (const n of snap.notes) {
    if (n.kind !== "note" || !n.course_id) continue
    const r = perNote.get(n.id)
    const s = stats.get(n.course_id)
    if (!s) {
      stats.set(n.course_id, { notes: 1, rounds: r?.count ?? 0, last_read: r?.last ?? null })
      continue
    }
    s.notes++
    s.rounds = Math.min(s.rounds, r?.count ?? 0)
    if (r?.last && (!s.last_read || r.last > s.last_read)) s.last_read = r.last
  }

  const q = query.q.toLowerCase()
  const rows: CourseRow[] = snap.courses
    .filter(
      (c) =>
        (query.status === "todos" || c.status === query.status) &&
        (q === "" || c.name.toLowerCase().includes(q)),
    )
    .map((c) => {
      const s = stats.get(c.id)
      return {
        ...c,
        notes: s?.notes ?? 0,
        rounds: s?.rounds ?? 0,
        last_read: s?.last_read ?? null,
        total_count: 0, // se completa abajo con el total real
      }
    })
    // `created_at desc` es el desempate final, igual que en la RPC.
    .toSorted((a, b) => SORTS[query.sort](a, b) || b.created_at.localeCompare(a.created_at))

  const total = rows.length
  const from = (query.page - 1) * query.pageSize
  return {
    // `total_count` viajaba repetido en cada fila de la RPC; se respeta la forma para no tocar la
    // pantalla. A diferencia de la RPC, una página fuera de rango sigue informando el total real.
    rows: rows.slice(from, from + query.pageSize).map((r) => ({ ...r, total_count: total })),
    total,
  }
}

// La cola de repaso. Reemplaza a la RPC `review_queue()` (migración 0003).
//
// Devuelve refs, no notas completas: el `content` de la nota servida lo pide Repaso aparte con
// `store.note(id)`, y sólo de la que está mirando.
//
// El `join courses` de la RPC dejaba afuera las notas sin curso (`course_id` null, curso borrado
// con FK set null — ADR 0002). Se replica. El `status` del curso NO filtra: active, paused y done
// entran igual (CONTEXT.md).
//
// Diferencia consciente con la RPC: ante empate de fecha, acá desempata `created_at` y después
// `id`. La RPC no desempataba, así que el orden lo elegía Postgres. Determinista es mejor que
// fiel a un no-determinismo.
export function reviewQueue(snap: Snapshot, limit: number): NoteRef[] {
  const perNote = readsByNote(snap.reads)
  const live = new Set(snap.courses.map((c) => c.id))

  return snap.notes
    .filter((n) => n.course_id && live.has(n.course_id))
    .toSorted((a, b) => {
      const la = perNote.get(a.id)?.last ?? null
      const lb = perNote.get(b.id)?.last ?? null
      if (la !== lb) {
        // nulls first: una nota que nunca se leyó gana siempre.
        if (!la) return -1
        if (!lb) return 1
        return la.localeCompare(lb)
      }
      return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
    })
    .slice(0, limit)
}

// % de retención por curso: correctos / autoevaluaciones (ADR 0003, nada denormalizado).
// El join read_log → notes(course_id) que antes hacía PostgREST, acá es un Map.
export function retention(snap: Snapshot): Map<string, number> {
  const courseOf = new Map(snap.notes.map((n) => [n.id, n.course_id]))
  const totals = new Map<string, { correct: number; total: number }>()
  for (const r of snap.reads) {
    if (!r.grade) continue
    const courseId = courseOf.get(r.note_id)
    if (!courseId) continue
    const t = totals.get(courseId) ?? { correct: 0, total: 0 }
    t.total++
    if (r.grade === "correcto") t.correct++
    totals.set(courseId, t)
  }
  return new Map([...totals].map(([id, t]) => [id, Math.round((t.correct / t.total) * 100)]))
}

// El `target` que le corresponde a un día del log: si la fila YA existe vale el suyo —congelado—,
// y si no, la meta viva del hábito (ADR 0009).
//
// Vive acá y no en los adapters a propósito. Cuando cada adapter lo resolvía por su cuenta no
// coincidían: el local respetaba el target guardado y el de Supabase lo pisaba con el del upsert.
// Ahora el llamador arma la fila completa y el adapter sólo la escribe.
export function frozenTarget(
  log: HabitLogRow[],
  habitId: string,
  day: string,
  liveTarget: number,
): number {
  return log.find((r) => r.habit_id === habitId && r.day === day)?.target ?? liveTarget
}
