import { MockLanguageModelV4 } from "ai/test"
import { runTurn } from "@/core/agent/turn"
import { localStore } from "@/core/store/local-store"
import { docToMarkdown, markdownToDoc } from "@/core/lib/tiptap-markdown"
import { applyProposal } from "@/core/agent/proposal"
import type { ApprovalLevel } from "@/core/agent/approval"
import type { Op } from "@/core/agent/tool"
import { agentTools } from "@/agent/tools"

// Niveles de aprobación en el seam del núcleo: cada nivel con una mezcla safe (create_notebook)
// + unsafe (update_note).

const store = localStore()
beforeEach(() => localStorage.clear())

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
}
const call = (toolName: string, input: object, id: string) => ({
  content: [
    {
      type: "tool-call" as const,
      toolCallId: id,
      toolName,
      input: JSON.stringify(input),
    },
  ],
  finishReason: { unified: "tool-calls" as const, raw: undefined },
  usage,
  warnings: [],
})
const say = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage,
  warnings: [],
})
const seen = (model: MockLanguageModelV4, i: number) =>
  JSON.stringify(model.doGenerateCalls[i].prompt.filter((m) => m.role === "tool"))

async function mixedTurn(approval: ApprovalLevel) {
  const nota = await store.save("notes", {
    title: "A",
    position: 0,
    content: markdownToDoc("uno"),
  })
  const model = new MockLanguageModelV4({
    doGenerate: [
      call("create_notebook", { name: "Nuevo" }, "a"),
      call("update_note", { id: nota.id, content: "dos" }, "b"),
      say("ok"),
    ],
  })
  const inverses: Op[][] = []
  const turn = await runTurn({
    model,
    store,
    tools: agentTools,
    messages: [{ role: "user", content: "hacé" }],
    approval,
    onApplied: (inv) => inverses.push(inv),
  })
  return {
    turn,
    inverses,
    model,
    body: async () => docToMarkdown((await store.note(nota.id)).content),
    notebooks: async () => (await store.snapshot()).notebooks,
  }
}

test("ask: nada se aplica, todo queda como Borrador", async () => {
  const { turn, inverses, body, notebooks } = await mixedTurn("ask")
  expect(turn.proposal?.ops.map((o) => o.entity)).toEqual(["notebooks", "notes"])
  expect(inverses).toEqual([])
  expect(await notebooks()).toHaveLength(0)
  expect(await body()).toBe("uno")
})

test("review: lo safe se aplica solo, lo unsafe queda como Borrador", async () => {
  const { turn, inverses, model, body, notebooks } = await mixedTurn("review")
  expect(await notebooks()).toHaveLength(1)
  expect(seen(model, 1)).toContain("Aplicado")
  expect(turn.proposal?.ops.map((o) => o.entity)).toEqual(["notes"])
  expect(await body()).toBe("uno")
  expect(inverses).toEqual([]) // una creación no tiene inversa (sin delete)
})

test("skip: todo directo, sin Propuesta; la inversa llega a onApplied y deshace", async () => {
  const { turn, inverses, body, notebooks } = await mixedTurn("skip")
  expect(turn.proposal).toBeNull()
  expect(await notebooks()).toHaveLength(1)
  expect(await body()).toBe("dos")
  expect(inverses).toHaveLength(1)
  await applyProposal(store, { ops: inverses[0] })
  expect(await body()).toBe("uno")
})

test("sin approval explícito el default es ask", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: [call("create_notebook", { name: "X" }, "a"), say("ok")],
  })
  const turn = await runTurn({
    model,
    store,
    tools: agentTools,
    messages: [{ role: "user", content: "x" }],
  })
  expect(turn.proposal?.ops).toHaveLength(1)
})

test("lo auto-aplicado se ve en las lecturas siguientes del mismo turno", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: [
      call("create_notebook", { name: "Física" }, "a"),
      call("get_overview", {}, "b"),
      say("ok"),
    ],
  })
  await runTurn({
    model,
    store,
    tools: agentTools,
    messages: [{ role: "user", content: "x" }],
    approval: "review",
  })
  expect(seen(model, 2)).toContain("Física")
})
