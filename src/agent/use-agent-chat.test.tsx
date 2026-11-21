import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { ModelMessage } from "ai"
import { useAgentChat } from "@/agent/use-agent-chat"
import type { ProviderConfig } from "@/core/agent/provider"
import type { Op } from "@/core/agent/tool"

// Seam del hilo: el modelo/turno son falsos; lo que se prueba es qué limpia "Nuevo chat".
const edit: Op = {
  entity: "notes",
  label: "Editar nota «X»",
  before: { id: "n1", content: "a" } as never,
  after: { id: "n1", content: "b" } as never,
}

vi.mock("@/core/agent/provider", async (orig) => ({
  ...(await orig<object>()),
  createModel: async () => ({}),
}))
const turns: { messages: ModelMessage[] }[] = []
vi.mock("@/core/agent/turn", () => ({
  runTurn: async (o: {
    messages: ModelMessage[]
    onApplied: (ops: Op[], inverse: Op[]) => void
  }) => {
    turns.push(o)
    o.onApplied([edit], [{ ...edit, before: edit.after, after: edit.before! }])
    return {
      messages: [{ role: "assistant", content: "listo" }],
      text: "listo",
      steps: 1,
      usage: { input: 10, output: 5 },
      finish: "stop",
      proposal: { ops: [edit] },
    }
  },
}))

const provider: ProviderConfig = {
  id: "p",
  kind: "anthropic",
  name: "A",
  apiKey: "k",
  models: [{ id: "m", visible: true }],
}
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

test("/skill args llega al modelo como instrucción del turno; /foo va como texto", async () => {
  const { result } = renderHook(() => useAgentChat(provider, "m"), { wrapper })
  await act(() => result.current.send("/resumir esta nota", null as never))

  const content = turns.at(-1)!.messages.at(-1)!.content as { type: string; text: string }[]
  expect(content[0].text).toBe("/resumir esta nota") // lo que ve el usuario
  expect(content[1].text).toContain('<skill nombre="resumir">')
  expect(content[1].text).toContain("Argumentos: esta nota")

  act(() => result.current.reset())
  await act(() => result.current.send("/foo bar", null as never))
  expect(turns.at(-1)!.messages.at(-1)!.content).toBe("/foo bar")
})

test("Nuevo chat limpia hilo, Propuesta, pila de undo y tokens", async () => {
  const { result } = renderHook(() => useAgentChat(provider, "m"), { wrapper })
  await act(() => result.current.send("hola", null as never))

  expect(result.current.messages).toHaveLength(2)
  expect(result.current.proposal?.status).toBe("pending")
  expect(result.current.undoable).toEqual(["Editar nota «X»"])
  expect(result.current.tokens).toEqual({ input: 10, output: 5 })
  expect(result.current.hasApplied()).toBe(true) // el panel pide confirmación antes de resetear

  act(() => result.current.reset())

  expect(result.current.messages).toEqual([])
  expect(result.current.proposal).toBeNull()
  expect(result.current.last).toBeNull()
  expect(result.current.undoable).toEqual([])
  expect(result.current.tokens).toEqual({ input: 0, output: 0 })
  expect(result.current.hasApplied()).toBe(false) // sin nada aplicado, el próximo reset no confirma
})

describe("historial", () => {
  beforeEach(() => localStorage.clear())

  test("persiste el chat, abrir uno vuelve a sus mensajes y borrar el activo pasa a uno nuevo", async () => {
    const { result } = renderHook(() => useAgentChat(provider, "m"), { wrapper })
    await act(() => result.current.send("primero", null as never))
    const first = result.current.chatId
    expect(result.current.chats.map((c) => c.id)).toEqual([first])

    act(() => result.current.discard()) // la Propuesta pendiente bloquea el cambio
    act(() => result.current.reset())
    expect(result.current.chatId).not.toBe(first)
    await act(() => result.current.send("segundo", null as never))
    expect(result.current.chats).toHaveLength(2)

    act(() => result.current.discard())
    act(() => result.current.openChat(first))
    expect(result.current.chatId).toBe(first)
    expect(result.current.messages[0]).toMatchObject({ content: "primero" })
    expect(result.current.undoable).toEqual([]) // el undo no persiste

    act(() => result.current.remove(first))
    expect(result.current.chats).toHaveLength(1)
    expect(result.current.messages).toEqual([])
    expect(result.current.chatId).not.toBe(first)
  })

  test("con una Propuesta pendiente no se puede cambiar de chat", async () => {
    const { result } = renderHook(() => useAgentChat(provider, "m"), { wrapper })
    await act(() => result.current.send("a", null as never))
    const id = result.current.chatId
    expect(result.current.canSwitch).toBe(false)
    act(() => result.current.openChat("otro"))
    expect(result.current.chatId).toBe(id)
  })
})
