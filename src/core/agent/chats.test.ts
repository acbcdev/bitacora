import type { ModelMessage } from "ai"
import {
  MAX_CHATS,
  MAX_RESULT,
  parseChats,
  relativeDay,
  truncateResults,
  upsertChat,
} from "./chats"

const user = (t: string): ModelMessage => ({ role: "user", content: t })
const tool = (value: unknown, type = "text"): ModelMessage => ({
  role: "tool",
  content: [
    { type: "tool-result", toolCallId: "1", toolName: "x", output: { type, value } as never },
  ],
})
const out = (m: ModelMessage) =>
  (m.content as { output: { type: string; value: string } }[])[0].output

test("upsert pone el chat primero, conserva createdAt y reemplaza por id", () => {
  let l = upsertChat([], "a", [user("1")], 10)
  l = upsertChat(l, "b", [user("2")], 20)
  l = upsertChat(l, "a", [user("1"), user("3")], 30)
  expect(l.map((c) => c.id)).toEqual(["a", "b"])
  expect(l[0]).toMatchObject({ createdAt: 10, updatedAt: 30 })
  expect(l[0].messages).toHaveLength(2)
})

test("tope: al crear el 21 cae el más viejo", () => {
  let l = upsertChat([], "c0", [user("x")], 0)
  for (let i = 1; i <= MAX_CHATS; i++) l = upsertChat(l, `c${i}`, [user("x")], i)
  expect(l).toHaveLength(MAX_CHATS)
  expect(l.some((c) => c.id === "c0")).toBe(false)
  expect(l[0].id).toBe(`c${MAX_CHATS}`)
})

test("trunca tool-results grandes (texto y json) y deja los chicos", () => {
  const big = "x".repeat(MAX_RESULT * 2)
  const [a, b, c] = truncateResults([tool(big), tool({ rows: big }, "json"), tool("ok")])
  expect(out(a).value.length).toBeLessThan(MAX_RESULT + 20)
  expect(out(b).type).toBe("text")
  expect(out(b).value.length).toBeLessThan(MAX_RESULT + 20)
  expect(out(c).value).toBe("ok")
})

test("un error-json grande sigue siendo error al truncarse", () => {
  const big = "x".repeat(MAX_RESULT * 2)
  const [a] = truncateResults([tool({ rows: big }, "error-json")])
  expect(out(a).type).toBe("error-text")
  expect(out(a).value.length).toBeLessThan(MAX_RESULT + 20)
})

test("parseChats tolera basura", () => {
  expect(parseChats(null)).toEqual([])
  expect(parseChats("{no")).toEqual([])
  expect(parseChats('{"a":1}')).toEqual([])
})

test("relativeDay", () => {
  const now = new Date(2026, 10, 20, 15).getTime()
  expect(relativeDay(new Date(2026, 10, 20, 1).getTime(), now)).toBe("hoy")
  expect(relativeDay(new Date(2026, 10, 19, 23).getTime(), now)).toBe("ayer")
  expect(relativeDay(new Date(2026, 10, 17).getTime(), now)).toBe("mar")
  expect(relativeDay(new Date(2026, 9, 5).getTime(), now)).toBe("05/10")
})

test("upsertChat persiste el meter y lo conserva si el guardado no trae uno (mensaje del usuario)", () => {
  const meter = {
    context: 2300,
    parts: { system: 132, tools: 580, skills: 0, attachments: 0, messages: 4, toolResults: 1584 },
    last: { input: 2200, output: 56 },
    session: { input: 2200, output: 56 },
  }
  let l = upsertChat([], "a", [user("1")], 10, meter)
  l = upsertChat(l, "a", [user("1"), user("2")], 20)
  expect(l[0].meter).toEqual(meter)
  expect(upsertChat([], "b", [user("x")], 0)[0]).not.toHaveProperty("meter")
})
