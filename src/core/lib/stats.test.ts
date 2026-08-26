import { deriveReadStats, lastDays } from "@/core/store/derive"

const now = new Date("2026-07-24T20:00:00")
const at = (day: string, h = "10:00:00") => `2026-07-${day}T${h}`

test("racha cuenta días consecutivos y no se rompe si hoy todavía no leyó", () => {
  // 22 y 23 sí, hoy (24) no → racha 2, hoy 0.
  const s = deriveReadStats(
    [
      { note_id: "n1", read_at: at("22"), grade: null },
      { note_id: "n2", read_at: at("23"), grade: null },
    ],
    now,
  )
  expect(s.streak).toBe(2)
  expect(s.today).toBe(0)
})

test("un hueco corta la racha; hoy suma", () => {
  const s = deriveReadStats(
    [
      { note_id: "n1", read_at: at("20"), grade: null }, // antes del hueco (21) — no cuenta
      { note_id: "n2", read_at: at("22"), grade: null },
      { note_id: "n3", read_at: at("23"), grade: null },
      { note_id: "n4", read_at: at("24"), grade: null },
    ],
    now,
  )
  expect(s.streak).toBe(3)
  expect(s.today).toBe(1)
})

test("byNote acumula repasos y guarda el último", () => {
  const s = deriveReadStats(
    [
      { note_id: "n1", read_at: at("22"), grade: null },
      { note_id: "n1", read_at: at("24", "09:00:00"), grade: null },
      { note_id: "n1", read_at: at("23"), grade: null },
    ],
    now,
  )
  expect(s.byNote.get("n1")).toEqual({ count: 3, last: at("24", "09:00:00") })
})

test("lastDays devuelve 14 días en orden, con huecos en cero y hoy al final", () => {
  const s = deriveReadStats(
    [
      { note_id: "n1", read_at: at("24"), grade: null },
      { note_id: "n2", read_at: at("24", "11:00:00"), grade: null },
      { note_id: "n3", read_at: at("22"), grade: null },
      { note_id: "n4", read_at: at("11"), grade: null }, // primer día de la ventana (14 días = desde el 11)
    ],
    now,
  )
  const days = lastDays(s.byDay, now)
  expect(days).toHaveLength(14)
  expect(days.at(-1)).toBe(2) // hoy, 24
  expect(days.at(-2)).toBe(0) // 23, hueco
  expect(days.at(-3)).toBe(1) // 22
  expect(days[0]).toBe(1) // 11
})
