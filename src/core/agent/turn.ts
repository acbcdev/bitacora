import {
  generateText,
  jsonSchema,
  stepCountIs,
  tool,
  type LanguageModel,
  type ModelMessage,
  type StopCondition,
  type ToolSet,
} from "ai"
import { dayKey } from "@/core/lib/day"
import type { Store } from "@/core/store/types"
import { buildSystemPrompt, type OpenContext } from "@/core/agent/prompt"
import type { AgentTool, ToolContext } from "@/core/agent/tool"
import { createDrafts } from "@/core/agent/drafts"
import type { Proposal } from "@/core/agent/proposal"

// Tope fijo de pasos (LLM ↔ tools) por turno.
export const MAX_STEPS = 25
// Un tool-call malformado vuelve al modelo como tool-result; tras 1 intento + 2 reintentos seguidos
// el turno corta.
export const MAX_MALFORMED = 3

const malformedCalls: StopCondition<ToolSet> = ({ steps }) => {
  let n = 0
  for (const s of steps.toReversed()) {
    if (!s.toolCalls.some((c) => c.invalid)) break
    n++
  }
  return n >= MAX_MALFORMED
}

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
  // "limit": cortó el tope de pasos con tools pendientes. "aborted": el usuario apretó Detener.
  // "malformed": el modelo agotó los reintentos de tool-call inválido (detalle en `malformed`).
  finish: "stop" | "limit" | "aborted" | "malformed"
  malformed?: string
  // Las escrituras del turno, sin aplicar. null = el turno no propuso nada.
  proposal: Proposal | null
}

// El núcleo: un turno = loop LLM ↔ tools hasta que el modelo responde sin pedir más tools.
// No conoce módulos de dominio: recibe las tools ya armadas (architecture.test.ts lo exige).
export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const now = input.now ?? new Date()
  const drafts = createDrafts(input.store)
  const ctx: ToolContext = { view: drafts.view, now }

  const tools = Object.fromEntries(
    input.tools.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: jsonSchema(t.schema),
        execute: async (args) => {
          const a = args as Record<string, unknown>
          if (t.risk === "read") return t.run(a, ctx)
          // Escribir = proponer: la Op entra a los Borradores y las lecturas siguientes la ven.
          const op = await t.plan(a, ctx)
          drafts.add(op)
          return `Propuesto (pendiente de aprobación del usuario, aún no aplicado): ${op.label}`
        },
      }),
    ]),
  )

  // Lo completado hasta ahora, para devolverlo parcial si el usuario detiene el turno.
  let done: ModelMessage[] = []
  let steps = 0
  const usage = { input: 0, output: 0 }
  const propose = () => (drafts.ops().length ? { ops: drafts.ops() } : null)

  try {
    const result = await generateText({
      model: input.model,
      instructions: buildSystemPrompt({
        today: dayKey(now),
        open: input.open ?? null,
      }),
      messages: input.messages,
      tools,
      stopWhen: [stepCountIs(MAX_STEPS), malformedCalls],
      abortSignal: input.abortSignal,
      prepareStep: ({ responseMessages }) => {
        done = responseMessages
        return undefined
      },
      onStepFinish: (step) => {
        steps++
        usage.input += step.usage.inputTokens ?? 0
        usage.output += step.usage.outputTokens ?? 0
      },
    })

    const bad = result.steps.at(-1)?.toolCalls.find((c) => c.invalid)
    const malformed = bad
      ? `${bad.toolName} ${JSON.stringify(bad.input)}: ${bad.error instanceof Error ? bad.error.message : String(bad.error)}`
      : undefined
    const stoppedMalformed =
      result.steps.length >= MAX_MALFORMED && malformedCalls({ steps: result.steps })
    return {
      messages: result.responseMessages,
      text: result.text,
      steps: result.steps.length,
      usage: {
        input: result.totalUsage.inputTokens ?? 0,
        output: result.totalUsage.outputTokens ?? 0,
      },
      finish: stoppedMalformed
        ? "malformed"
        : result.finishReason === "tool-calls"
          ? "limit"
          : "stop",
      malformed: stoppedMalformed ? malformed : undefined,
      proposal: propose(),
    }
  } catch (e) {
    if (!input.abortSignal?.aborted) throw e
    return {
      messages: done,
      text: "",
      steps,
      usage,
      finish: "aborted",
      proposal: propose(),
    }
  }
}
