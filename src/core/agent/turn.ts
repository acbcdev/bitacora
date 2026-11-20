import {
  generateText,
  jsonSchema,
  stepCountIs,
  tool,
  type LanguageModel,
  type ModelMessage,
} from "ai"
import { dayKey } from "@/core/lib/day"
import type { Store } from "@/core/store/types"
import { buildSystemPrompt, type OpenContext } from "@/core/agent/prompt"
import type { AgentTool, AgentView, ToolContext } from "@/core/agent/tool"

// Tope fijo de pasos (LLM ↔ tools) por turno.
export const MAX_STEPS = 25

export type TurnInput = {
  model: LanguageModel
  store: Store
  tools: AgentTool[]
  // Historial previo (ya incluye el mensaje nuevo del usuario al final).
  messages: ModelMessage[]
  open?: OpenContext
  abortSignal?: AbortSignal
  now?: Date
}

export type TurnResult = {
  // Mensajes que produjo el turno (assistant + tool). El caller los appendea al historial.
  messages: ModelMessage[]
  text: string
  steps: number
  usage: { input: number; output: number }
  // "limit": cortó el tope de pasos con tools pendientes.
  finish: "stop" | "limit"
}

// El núcleo: un turno = loop LLM ↔ tools hasta que el modelo responde sin pedir más tools.
// No conoce módulos de dominio: recibe las tools ya armadas (architecture.test.ts lo exige).
export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const now = input.now ?? new Date()
  const view: AgentView = {
    snapshot: () => input.store.snapshot(),
    note: (id) => input.store.note(id),
  }
  const ctx: ToolContext = { view, now }

  const tools = Object.fromEntries(
    input.tools.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: jsonSchema(t.schema),
        execute: (args) => t.run(args as Record<string, unknown>, ctx),
      }),
    ]),
  )

  const result = await generateText({
    model: input.model,
    instructions: buildSystemPrompt({ today: dayKey(now), open: input.open ?? null }),
    messages: input.messages,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    abortSignal: input.abortSignal,
  })

  return {
    messages: result.responseMessages,
    text: result.text,
    steps: result.steps.length,
    usage: {
      input: result.totalUsage.inputTokens ?? 0,
      output: result.totalUsage.outputTokens ?? 0,
    },
    finish: result.finishReason === "tool-calls" ? "limit" : "stop",
  }
}
