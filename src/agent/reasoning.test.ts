import { StreamedMock } from "@/agent/streamed-mock"
import { THINKING_BUDGET, runTurn, thinkingMs } from "@/core/agent/turn"
import { localStore } from "@/core/store/local-store"
import { agentTools } from "@/agent/tools"

const store = localStore()
beforeEach(() => localStorage.clear())

const think = (text: string) => ({ type: "reasoning" as const, text })
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 5, reasoning: 15 },
}
const stop = { unified: "stop" as const, raw: undefined }
const say = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: stop,
  usage,
  warnings: [],
})
const user = (text: string) => [{ role: "user" as const, content: text }]

test("el turno guarda la parte reasoning con su duración y cuenta sus tokens", async () => {
  const model = new StreamedMock({
    doGenerate: [
      {
        content: [think("Primero miro la nota."), { type: "text", text: "Listo." }],
        finishReason: stop,
        usage,
        warnings: [],
      },
    ],
  })
  const turn = await runTurn({ model, store, tools: agentTools, messages: user("hola") })

  const part = turn.messages.flatMap((m) =>
    m.role === "assistant" && typeof m.content !== "string" ? m.content : [],
  )[0]
  expect(part).toMatchObject({ type: "reasoning", text: "Primero miro la nota." })
  expect(thinkingMs(part as never)).toBeTypeOf("number")
  expect(turn.usage).toEqual({ input: 10, output: 20, reasoning: 15 })
})

test("el historial reenviado no lleva reasoning de turnos anteriores", async () => {
  const model = new StreamedMock({ doGenerate: [say("ok")] })
  await runTurn({
    model,
    store,
    tools: agentTools,
    messages: [
      { role: "user", content: "a" },
      { role: "assistant", content: [think("pienso"), { type: "text", text: "respuesta" }] },
      { role: "assistant", content: [think("solo pienso")] },
      { role: "user", content: "b" },
    ],
  })
  const prompt = JSON.stringify(model.doGenerateCalls[0].prompt)
  expect(prompt).toContain("respuesta")
  expect(prompt).not.toContain("pienso")
})

test("dentro del loop de tools el SDK devuelve el reasoning del paso al modelo", async () => {
  const model = new StreamedMock({
    doGenerate: [
      {
        content: [
          think("Necesito el resumen."),
          { type: "tool-call", toolCallId: "c1", toolName: "get_overview", input: "{}" },
        ],
        finishReason: { unified: "tool-calls", raw: undefined },
        usage,
        warnings: [],
      },
      say("ok"),
    ],
  })
  await runTurn({ model, store, tools: agentTools, messages: user("hola") })
  expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain("Necesito el resumen.")
})

test("pide extended thinking solo a Anthropic con modelo que lo soporta", async () => {
  const run = async (provider: string, modelId: string) => {
    const model = new StreamedMock({ provider, modelId, doGenerate: [say("ok")] })
    await runTurn({ model, store, tools: agentTools, messages: user("hola") })
    return model.doGenerateCalls[0].providerOptions
  }
  expect(await run("anthropic.messages", "claude-sonnet-4-5")).toEqual({
    anthropic: { thinking: { type: "enabled", budgetTokens: THINKING_BUDGET } },
  })
  expect(await run("anthropic.messages", "claude-3-5-haiku-latest")).toBeUndefined()
  expect(await run("openrouter.chat", "x/y")).toBeUndefined()
})

test("el texto del paso se transmite por onStream antes de que cierre el turno", async () => {
  const model = new StreamedMock({ doGenerate: [say("Hola mundo")] })
  const seen: string[] = []
  const turn = await runTurn({
    model,
    store,
    tools: agentTools,
    messages: user("hola"),
    onStream: (l) => seen.push(l.text),
  })
  expect(seen).toEqual(["Hola mundo"])
  expect(turn.text).toBe("Hola mundo")
})
