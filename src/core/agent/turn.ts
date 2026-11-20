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
import type { AgentTool, Op, ToolContext } from "@/core/agent/tool"
import { createDrafts } from "@/core/agent/drafts"
import { applyProposal, type Proposal } from "@/core/agent/proposal"
import { autoApplies, type ApprovalLevel } from "@/core/agent/approval"

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
  // Default "ask": todo va a la Propuesta.
  approval?: ApprovalLevel
  // Lo auto-aplicado entrega acá sus Ops inversas (la pila de undo del caller).
  onApplied?: (inverse: Op[]) => void
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
          if (autoApplies(input.approval ?? "ask", t.risk)) {
            const inverse = await applyProposal(input.store, { ops: [op] })
            if (inverse.length) input.onApplied?.(inverse) // creaciones: sin inversa
            return `Aplicado: ${op.label}`
          }
          drafts.add(op)
          return `Propuesto (pendiente de aprobación del usuario, aún no aplicado): ${op.label}`
        },
      }),
    ]),
  )

  const result = await generateText({
    model: input.model,
    instructions: buildSystemPrompt({
      today: dayKey(now),
      open: input.open ?? null,
    }),
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
    proposal: drafts.ops().length ? { ops: drafts.ops() } : null,
  }
}
