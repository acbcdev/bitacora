import type { Course, CourseRow, Note } from "@/core/types/database"
import type { CoursesQuery, GradedRead, ReadRow } from "@/core/store/types"

// Derivación pura: filas crudas → hechos del dominio. Sin React, sin Supabase, sin localStorage.
//
// Por qué existe: ADR 0003 manda derivar todo de `read_log`, y hasta ahora eso vivía en tres
// lugares con tres estrategias (RPC `courses_page` en SQL, `useReadStats` en JS, `useRetention`
// con un join + JS). En cuanto hay un segundo adapter la parte que estaba en SQL tiene que
// existir en JS igual — así que vive acá una sola vez, y `localStore` la usa.
//
// `supabaseStore` sigue delegando `coursesPage`/`reviewQueue` a las RPC: Postgres ya las tiene
// y traerse 1.500 notas para ordenarlas en el cliente sería peor. Lo que sí comparten los dos
// adapters es `retention()`. Estas funciones son, además, el contrato ejecutable de lo que
// las RPC prometen — si algún día divergen, el test de acá lo dice.

// Cuántas veces se leyó cada nota y cuándo fue la última. Base de `rounds` y `last_read`.
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

// Comparadores de `order by`, uno por valor de `sort`. En la RPC son tres ramas `case when` que
// se anulan entre sí; acá es un lookup y se lee de una.
// `nombre` usa localeCompare (acentos) donde Postgres usa su collation — diferencia consciente,
// y la que un usuario espera.
const SORTS: Record<CoursesQuery["sort"], (a: CourseRow, b: CourseRow) => number> = {
  nombre: (a, b) => a.name.localeCompare(b.name),
  rondas: (a, b) => b.rounds - a.rounds,
  // 'recientes' e 'inicio' son el mismo criterio desde la migración 0009: started_at desc,
  // nulls last (para los 57 cursos importados created_at es sólo la hora del batch).
  inicio: (a, b) => byStartedAt(a, b),
  recientes: (a, b) => byStartedAt(a, b),
}

function byStartedAt(a: CourseRow, b: CourseRow) {
  if (a.started_at === b.started_at) return 0
  if (!a.started_at) return 1 // nulls last
  if (!b.started_at) return -1
  return b.started_at.localeCompare(a.started_at)
}

// Espejo en JS de la RPC `courses_page` (migraciones 0006-0009): filtra, agrega notas/rondas/
// último repaso, ordena y pagina.
//
// `rounds` es el MÍNIMO de repasos entre las notas del curso — "cuántas vueltas completas le
// diste", no el total. Un curso con una nota sin leer tiene 0 rondas por más que las otras 24
// estén leídas 5 veces. Sale así de la RPC (`min(coalesce(rd.cnt, 0))`) y se mantiene.
export function coursesPage(
  courses: Course[],
  notes: Note[],
  reads: ReadRow[],
  query: CoursesQuery,
): { rows: CourseRow[]; total: number } {
  const perNote = readsByNote(reads)

  // Sólo notas vivas, kind 'note' y con curso: las flashcards no cuentan para el progreso
  // de un curso (ADR 0010) y una nota huérfana no tiene a quién sumarle.
  const stats = new Map<string, { notes: number; rounds: number; last_read: string | null }>()
  for (const n of notes) {
    if (n.deleted_at || n.kind !== "note" || !n.course_id) continue
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
  const filtered: CourseRow[] = courses
    .filter(
      (c) =>
        !c.deleted_at &&
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
        // `count(*) over ()` viaja repetido en cada fila; se completa abajo con el total real.
        total_count: 0,
      }
    })

  // created_at desc es el desempate final en la RPC, para los dos cursos que empatan en el
  // criterio elegido.
  const sorted = filtered.toSorted(
    (a, b) => SORTS[query.sort](a, b) || b.created_at.localeCompare(a.created_at),
  )

  const total = sorted.length
  const from = (query.page - 1) * query.pageSize
  return {
    rows: sorted.slice(from, from + query.pageSize).map((r) => ({ ...r, total_count: total })),
    total,
  }
}

// Espejo en JS de la RPC `review_queue()` (migración 0003): notas vivas de cursos vivos, la más
// vieja primero, nunca-leídas antes que todo.
//
// El `join courses` de la RPC deja afuera las notas sin curso (course_id null, curso borrado con
// FK set null — ADR 0002). Se replica: si no, la cola local traería notas que la remota no trae.
// El `status` del curso NO filtra: active, paused y done entran igual (CONTEXT.md).
//
// Diferencia consciente con la RPC: acá el empate se rompe por created_at y después por id. La
// RPC no tiene desempate, así que ante empate el orden es el que quiera Postgres. Determinista
// es mejor que fiel a un no-determinismo.
export function reviewQueue(
  courses: Course[],
  notes: Note[],
  reads: ReadRow[],
  limit: number,
): Note[] {
  const perNote = readsByNote(reads)
  const live = new Set(courses.filter((c) => !c.deleted_at).map((c) => c.id))

  return notes
    .filter((n) => !n.deleted_at && n.course_id && live.has(n.course_id))
    .toSorted((a, b) => {
      const la = perNote.get(a.id)?.last ?? null
      const lb = perNote.get(b.id)?.last ?? null
      // nulls first: una nota que nunca se leyó gana siempre.
      if (la !== lb) {
        if (!la) return -1
        if (!lb) return 1
        return la.localeCompare(lb)
      }
      return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
    })
    .slice(0, limit)
}

// % de retención por curso: correctos / autoevaluaciones. Lo usan los DOS adapters — es el
// único cálculo que hoy ya se hacía en JS en los dos lados del seam.
export function retention(rows: GradedRead[]): Map<string, number> {
  const totals = new Map<string, { correct: number; total: number }>()
  for (const row of rows) {
    if (!row.course_id) continue
    const t = totals.get(row.course_id) ?? { correct: 0, total: 0 }
    t.total++
    if (row.grade === "correcto") t.correct++
    totals.set(row.course_id, t)
  }
  return new Map([...totals].map(([id, t]) => [id, Math.round((t.correct / t.total) * 100)]))
}
