import { fireEvent, render, screen } from "@testing-library/react"
import type { ModelMessage } from "ai"
import { ToolBlock } from "@/agent/tool-block"
import { toolResults } from "@/agent/agent-panel"

test("resultado de error: estado «falló» en destructive, no «completado»", () => {
  render(<ToolBlock name="leer_nota" input={{}} result="id inexistente" isError busy={false} />)
  expect(screen.getByText("falló")).toHaveClass("text-destructive")
  expect(screen.queryByText("completado")).toBeNull()
})

test("resultado normal: completado; al abrir, parámetros en una línea y el resultado", () => {
  render(<ToolBlock name="buscar" input={{ query: "x", limit: 5 }} result="ok" busy={false} />)
  expect(screen.getByText("completado")).toBeInTheDocument()
  expect(screen.queryByText("ok")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: /buscar/ }))
  expect(screen.getByText('query: "x" · limit: 5')).toBeInTheDocument()
  expect(screen.getByText("ok")).toBeInTheDocument()
})

test("sin resultado: ejecutando si el Agente está ocupado, sin estado si no", () => {
  const { rerender } = render(<ToolBlock name="t" input={{}} busy />)
  expect(screen.getByText("ejecutando…")).toBeInTheDocument()
  rerender(<ToolBlock name="t" input={{}} busy={false} />)
  expect(screen.queryByText("ejecutando…")).toBeNull()
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
