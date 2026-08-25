import { useQuery } from "@tanstack/react-query"
import { store } from "@/core/store"

// Meta diaria = el batch de review_queue() (migrations/0003). El diseño muestra "leídas hoy N/M".
export const DAILY_GOAL = 3

export type NoteReads = { count: number; last: string | null }
export type ReadStats = {
  today: number
  streak: number
  byNote: Map<string, NoteReads>
  byDay: Map<string, number>
}

type ReadRow = { note_id: string; read_at: string }

const EMPTY: ReadStats = { today: 0, streak: 0, byNote: new Map(), byDay: new Map() }

// Ventana del hover de la racha. Misma que la de hábitos: más atrás es un calendario, otra UI.
export const HISTORY_DAYS = 14

// Fecha local (no UTC): la racha se cuenta en los días del usuario, no del servidor.
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function todayKey() {
  return dayKey(new Date())
}

// read_at es timestamptz: cortarlo con slice(0,10) daría el día UTC (a la noche, el de mañana).
export function dayOf(iso: string | null | undefined) {
  return iso ? dayKey(new Date(iso)) : "—"
}

const RTF = new Intl.RelativeTimeFormat("es", { numeric: "auto" })

// "hace 2 semanas" — para tarjetas, donde la fecha exacta importa menos que la sensación de tiempo.
export function relativeDay(iso: string | null | undefined) {
  if (!iso) return "—"
  const diffDays = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  const abs = Math.abs(diffDays)
  if (abs < 1) return RTF.format(0, "day")
  if (abs < 7) return RTF.format(diffDays, "day")
  if (abs < 30) return RTF.format(Math.round(diffDays / 7), "week")
  if (abs < 365) return RTF.format(Math.round(diffDays / 30), "month")
  return RTF.format(Math.round(diffDays / 365), "year")
}

// Racha = días consecutivos con al menos un repaso. Si hoy todavía no leyó, la racha de ayer
// sigue viva (no se rompe hasta que pasa el día completo sin leer).
export function deriveReadStats(rows: ReadRow[], now = new Date()): ReadStats {
  const byDay = new Map<string, number>()
  const byNote = new Map<string, NoteReads>()
  for (const r of rows) {
    const day = dayKey(new Date(r.read_at))
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
    const prev = byNote.get(r.note_id)
    byNote.set(r.note_id, {
      count: (prev?.count ?? 0) + 1,
      last: !prev?.last || r.read_at > prev.last ? r.read_at : prev.last,
    })
  }

  const cursor = new Date(now)
  if (!byDay.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (byDay.has(dayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return { today: byDay.get(dayKey(now)) ?? 0, streak, byNote, byDay }
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

// Todo derivado de read_log (ADR 0003): racha, leídas hoy, repasos y último repaso por nota.
// ponytail: baja read_log entero y agrega en JS. A 2–3 notas/día son ~1k filas/año — cabe de
// sobra en el cliente. Si alguna vez pesa, mover el GROUP BY a una RPC.
export function useReadStats() {
  return useQuery({
    queryKey: ["read_stats"],
    queryFn: async (): Promise<ReadStats> => deriveReadStats(await store.readLog()),
    placeholderData: EMPTY,
  })
}
