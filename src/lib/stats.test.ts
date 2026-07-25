import { deriveReadStats } from "@/lib/stats"

const now = new Date("2026-07-24T20:00:00")
const at = (day: string, h = "10:00:00") => `2026-07-${day}T${h}`

test("racha cuenta días consecutivos y no se rompe si hoy todavía no leyó", () => {
  // 22 y 23 sí, hoy (24) no → racha 2, hoy 0.
  const s = deriveReadStats([{ note_id: "n1", read_at: at("22") }, { note_id: "n2", read_at: at("23") }], now)
  expect(s.streak).toBe(2)
  expect(s.today).toBe(0)
})

test("un hueco corta la racha; hoy suma", () => {
  const s = deriveReadStats(
    [
      { note_id: "n1", read_at: at("20") }, // antes del hueco (21) — no cuenta
      { note_id: "n2", read_at: at("22") },
      { note_id: "n3", read_at: at("23") },
      { note_id: "n4", read_at: at("24") },
    ],
    now,
  )
  expect(s.streak).toBe(3)
  expect(s.today).toBe(1)
})

test("byNote acumula repasos y guarda el último", () => {
  const s = deriveReadStats(
    [
      { note_id: "n1", read_at: at("22") },
      { note_id: "n1", read_at: at("24", "09:00:00") },
      { note_id: "n1", read_at: at("23") },
    ],
    now,
  )
  expect(s.byNote.get("n1")).toEqual({ count: 3, last: at("24", "09:00:00") })
})
