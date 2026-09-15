import { daysSince } from "@/core/lib/day"

const now = new Date("2026-06-15T12:00:00")

test("daysSince cuenta días completos desde el instante", () => {
  expect(daysSince("2026-06-13T12:00:00", now)).toBe(2)
  expect(daysSince(now.toISOString(), now)).toBe(0)
})

test("daysSince: null sin fecha y clamp para read_at a futuro (clock skew)", () => {
  expect(daysSince(null, now)).toBeNull()
  expect(daysSince("2026-06-20T12:00:00", now)).toBe(0)
})
