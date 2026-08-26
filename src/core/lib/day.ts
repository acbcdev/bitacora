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
