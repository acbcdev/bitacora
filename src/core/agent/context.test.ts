import { contextParts } from "@/core/agent/context"
import { userMessage } from "@/core/agent/attachments"

test("contextParts: clasifica por categoría y reparte el total real (suma = total)", () => {
  const parts = contextParts(
    "x".repeat(100),
    [{ name: "t", description: "y".repeat(50) }],
    [
      userMessage(
        "hola",
        [{ kind: "text", tag: "nota", attrs: { id: "1" }, body: "z".repeat(200) }],
        {
          name: "resumir",
          prompt: "s".repeat(80),
          args: "",
        },
      ),
      {
        role: "assistant",
        content: [
          { type: "reasoning", text: "r".repeat(9999) },
          { type: "tool-call", toolCallId: "c", toolName: "read_note", input: { id: "1" } },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "c",
            toolName: "read_note",
            output: { type: "text", value: "w".repeat(300) },
          },
        ],
      },
      { role: "assistant", content: "listo" },
    ],
    1000,
  )
  expect(Object.values(parts).every((n) => n > 0)).toBe(true)
  expect(parts.attachments).toBeGreaterThan(parts.skills)
  expect(parts.toolResults).toBeGreaterThan(parts.system) // reasoning (9999) no cuenta
  expect(Object.values(parts).reduce((a, b) => a + b, 0)).toBeCloseTo(1000, -1)
})
