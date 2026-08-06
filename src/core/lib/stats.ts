import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/core/lib/supabase"

// Meta diaria = el batch de review_queue() (migrations/0003). El diseño muestra "leídas hoy N/M".
export const DAILY_GOAL = 3

export type NoteReads = { count: number; last: string | null }
export type ReadStats = { today: number; streak: number; byNote: Map<string, NoteReads> }

type ReadRow = { note_id: string; read_at: string }

const EMPTY: ReadStats = { today: 0, streak: 0, byNote: new Map() }

// Fecha local (no UTC): la racha se cuenta en los días del usuario, no del servidor.
function dayKey(d: Date) {
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
  const days = new Set<string>()
  const byNote = new Map<string, NoteReads>()
  for (const r of rows) {
    days.add(dayKey(new Date(r.read_at)))
    const prev = byNote.get(r.note_id)
    byNote.set(r.note_id, {
      count: (prev?.count ?? 0) + 1,
      last: !prev?.last || r.read_at > prev.last ? r.read_at : prev.last,
    })
  }

  const cursor = new Date(now)
  const today = days.has(dayKey(cursor))
  if (!today) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  const today0 = dayKey(now)
  return {
    today: rows.filter((r) => dayKey(new Date(r.read_at)) === today0).length,
    streak,
    byNote,
  }
}

// Todo derivado de read_log (ADR 0003): racha, leídas hoy, repasos y último repaso por nota.
// ponytail: baja read_log entero y agrega en JS. A 2–3 notas/día son ~1k filas/año — cabe de
// sobra en el cliente. Si alguna vez pesa, mover el GROUP BY a una RPC.
export function useReadStats() {
  return useQuery({
    queryKey: ["read_stats"],
    queryFn: async (): Promise<ReadStats> => {
      const { data, error } = await supabase.from("read_log").select("note_id, read_at")
      if (error) throw error
      return deriveReadStats(data)
    },
    placeholderData: EMPTY,
  })
}
