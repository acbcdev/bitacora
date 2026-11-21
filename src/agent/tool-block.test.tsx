import { render, screen } from "@testing-library/react"
import type { ModelMessage } from "ai"
import { ToolBlock } from "@/agent/tool-block"
import { toolResults } from "@/agent/agent-panel"

test("resultado de error: badge Error en destructive, no Completado", () => {
  render(<ToolBlock name="leer_nota" input={{}} result="id inexistente" isError busy={false} />)
  expect(screen.getByText("Error")).toHaveClass("text-destructive")
  expect(screen.queryByText("Completado")).toBeNull()
})

test("resultado normal sigue Completado", () => {
  render(<ToolBlock name="leer_nota" input={{}} result="ok" busy={false} />)
  expect(screen.getByText("Completado")).toBeInTheDocument()
})

test("toolResults marca error cuando output.type es de error", () => {
  const messages = [
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "a",
          toolName: "t",
          output: { type: "error-text", value: "boom" },
        },
        {
          type: "tool-result",
          toolCallId: "b",
          toolName: "t",
          output: { type: "text", value: "ok" },
        },
      ],
    },
  ] as ModelMessage[]
  const r = toolResults(messages)
  expect(r.get("a")).toEqual({ text: "boom", isError: true })
  expect(r.get("b")).toEqual({ text: "ok", isError: false })
})
