import { dayKey } from "@/core/lib/day"
import type {
  Course,
  CourseRow,
  CourseStatus,
  Habit,
  HabitKind,
  HabitPeriod,
} from "@/core/types/database"
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

// Meta diaria = el batch de review_queue() (migrations/0003). El diseño muestra "leídas hoy N/M".
export const DAILY_GOAL = 3

// Ventana del hover de la racha. Misma que la de hábitos: más atrás es un calendario, otra UI.
export const HISTORY_DAYS = 14

export type NoteReads = { count: number; last: string | null }
export type ReadStats = {
  today: number
  streak: number
  byNote: Map<string, NoteReads>
  byDay: Map<string, number>
}

export const EMPTY_READ_STATS: ReadStats = {
  today: 0,
  streak: 0,
  byNote: new Map(),
  byDay: new Map(),
}

// Racha = días consecutivos con al menos un repaso. Si hoy todavía no leyó, la racha de ayer
// sigue viva (no se rompe hasta que pasa el día completo sin leer).
export function readStats(snap: Snapshot, now = new Date()): ReadStats {
  const byDay = new Map<string, number>()
  for (const r of snap.reads) {
    const day = dayKey(new Date(r.read_at))
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }
  const byNote = readsByNote(snap.reads) as Map<string, NoteReads>

  const cursor = new Date(now)
  if (!byDay.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (byDay.has(dayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return { today: byDay.get(dayKey(now)) ?? 0, streak, byNote, byDay }
}

// Granular para tests: misma lógica sin necesidad de armar un Snapshot.
export function deriveReadStats(rows: ReadRow[], now = new Date()): ReadStats {
  return readStats({ courses: [], notes: [], reads: rows, habits: [], habitLog: [] }, now)
}

// Los últimos HISTORY_DAYS días en orden, con los huecos en cero: la grilla necesita las celdas
// vacías, y byDay sólo tiene los días que existieron.
export function lastDays(byDay: Map<string, number> | undefined, now = new Date()) {
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (HISTORY_DAYS - 1 - i))
    return byDay?.get(dayKey(d)) ?? 0
  })
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

// ── Hábitos ──────────────────────────────────────────────────────────────

export type DayCell = { amount: number; target: number }
export type HabitState = {
  total: number
  today: number
  met: boolean
  streak: number
  days: DayCell[]
}

// Ventana de la serie por período (dots del tile + panel): celdas del período del hábito
// (ADR 0013). Más atrás es un calendario, que es otra UI (spec: Out of Scope).
export const SERIES: Record<HabitPeriod, number> = { day: 14, week: 7, month: 6 }

// good = piso (llegar al target), bad = techo (no pasarlo). Mismo cálculo, signo distinto.
export const meets = (kind: HabitKind, total: number, target: number) =>
  kind === "good" ? total >= target : total <= target

// La fecha del índice `i` de la serie DIARIA (13 = hoy). Sólo la usa el panel de hábitos
// diarios — la corrección de días pasados no existe para semana/mes (ADR 0013).
export function dayAt(i: number, now = new Date()) {
  const d = new Date(now)
  d.setDate(d.getDate() - (SERIES.day - 1 - i))
  return d
}

// habit_log.day ya es fecha local (ADR 0009): se parsea con las partes explícitas y NO con
// new Date(day), que lo leería como UTC y a la noche devolvería el día anterior.
function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d)
}

// El lunes de esa semana. getDay() es 0=dom, así que el corrimiento es (día + 6) % 7.
function monday(d: Date) {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

const KEY: Record<HabitPeriod, (d: Date) => string> = {
  day: dayKey,
  week: (d) => dayKey(monday(d)),
  month: (d) => dayKey(d).slice(0, 7),
}

// Clave del período que contiene `d`. Las tres ordenan lexicográficamente igual que
// cronológicamente, que es lo que hace comparable "¿este período es anterior al de created_at?".
export function periodKey(d: Date, period: HabitPeriod) {
  return KEY[period](d)
}

// Muta el cursor un período hacia atrás. En `month` primero va al día 1: sin eso, restarle un mes
// al 31 de marzo cae en marzo otra vez (31 de febrero no existe).
const stepBack: Record<HabitPeriod, (d: Date) => void> = {
  day: (d) => d.setDate(d.getDate() - 1),
  week: (d) => d.setDate(d.getDate() - 7),
  month: (d) => {
    d.setDate(1)
    d.setMonth(d.getMonth() - 1)
  },
}

// `total` es la SUMA de amount del período (en `time`, minutos), no un count: las tres métricas
// comparten esta función y no hay una sola rama por métrica.
// `habit.days` (el schedule lun/mié/vie) no se lee acá a propósito — es recordatorio, no regla
// (ADR 0009). Si alguna vez aparece en este archivo, está mal.
export function deriveHabit(habit: Habit, rows: HabitLogRow[], now = new Date()): HabitState {
  const byDay = new Map<string, HabitLogRow>()
  // Un período = { suma de amount, target congelado }. Con varias filas y targets distintos en el
  // mismo período gana el de la fila más nueva.
  const periods = new Map<string, { total: number; target: number; day: string }>()

  for (const r of rows) {
    if (r.habit_id !== habit.id) continue
    byDay.set(r.day, r)
    const key = periodKey(parseDay(r.day), habit.period)
    const prev = periods.get(key)
    if (!prev) {
      periods.set(key, { total: r.amount, target: r.target, day: r.day })
    } else {
      prev.total += r.amount
      if (r.day > prev.day) {
        prev.target = r.target
        prev.day = r.day
      }
    }
  }

  const currentKey = periodKey(now, habit.period)
  const metAt = (key: string) => {
    const p = periods.get(key)
    // El período actual se puntúa contra la meta VIVA (subirla hoy re-puntúa hoy); los cerrados,
    // contra el target congelado de sus filas — eso es lo que sostiene las rachas viejas (ADR 0009).
    const target = key === currentKey ? habit.target : (p?.target ?? habit.target)
    return meets(habit.kind, p?.total ?? 0, target)
  }

  const met = metAt(currentKey)

  // Racha = períodos cumplidos consecutivos hacia atrás. El piso es el período en que se creó el
  // hábito: antes de existir no hay nada que cumplir (y sin ese piso un `bad` sin filas contaría
  // hacia atrás para siempre).
  const floor = periodKey(new Date(habit.created_at), habit.period)
  const cursor = new Date(now)
  // En un `good`, el período actual todavía sin cumplir no corta la racha (misma regla que
  // deriveReadStats). En un `bad` sí: pasarse del techo es el fracaso, no una tarea pendiente.
  if (!met && habit.kind === "good") stepBack[habit.period](cursor)
  let streak = 0
  while (periodKey(cursor, habit.period) >= floor && metAt(periodKey(cursor, habit.period))) {
    streak++
    stepBack[habit.period](cursor)
  }

  // Serie en el período del hábito (ADR 0013): N celdas caminando períodos hacia atrás con las
  // mismas primitivas de la racha. Celda cerrada contra el target congelado de sus filas, la
  // actual contra la meta viva. Un período sin filas es 0 con el target vivo — el pct manda.
  const days: DayCell[] = []
  const serieCursor = new Date(now)
  for (let i = 0; i < SERIES[habit.period]; i++) {
    const key = periodKey(serieCursor, habit.period)
    const p = periods.get(key)
    days.unshift({
      amount: p?.total ?? 0,
      target: key === currentKey ? habit.target : (p?.target ?? habit.target),
    })
    stepBack[habit.period](serieCursor)
  }

  return {
    total: periods.get(currentKey)?.total ?? 0,
    // amount de HOY (día), no del período: el toggle del tile y el cronómetro escriben la fila
    // de hoy — sumarle el total de la semana le pisaría los días anteriores.
    today: byDay.get(dayKey(now))?.amount ?? 0,
    met,
    streak,
    days,
  }
}

// Snapshot → HabitState. Un habit, un lugar: la firma es Snapshot como el resto de derive.
export function habitState(snap: Snapshot, habitId: string, now = new Date()): HabitState | null {
  const habit = snap.habits.find((h) => h.id === habitId)
  if (!habit) return null
  return deriveHabit(habit, snap.habitLog, now)
}
