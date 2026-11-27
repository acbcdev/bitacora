import {
  streamText,
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
import type { AgentTool, Op, ToolContext } from "@/core/agent/tool"
import { createDrafts } from "@/core/agent/drafts"
import { applyProposal, type Proposal } from "@/core/agent/proposal"
import { autoApplies, type ApprovalLevel } from "@/core/agent/approval"
import { contextParts, type ContextParts } from "@/core/agent/context"

// Tope fijo de pasos (LLM ↔ tools) por turno.
export const MAX_STEPS = 25
// Un tool-call malformado vuelve al modelo como tool-result; tras 1 intento + 2 reintentos seguidos
// el turno corta.
export const MAX_MALFORMED = 3
// Extended thinking de Anthropic: presupuesto fijo, sin config (el SDK lo suma a max_tokens).
export const THINKING_BUDGET = 4000
// Anthropic sin extended thinking: pedírselo da 400.
const NO_THINKING = /^claude-(3-5|3-haiku|3-opus|3-sonnet|2|instant)/

// Namespace propio en providerOptions de la parte reasoning: guarda cuánto tardó el paso.
export const THINK_NS = "bitacora"
export const thinkingMs = (p: { providerOptions?: Record<string, Record<string, unknown>> }) => {
  const ms = p.providerOptions?.[THINK_NS]?.thinkingMs
  return typeof ms === "number" ? ms : undefined
}

// El reasoning de turnos anteriores no se reenvía; dentro del loop de tools del turno el SDK
// conserva el suyo (Anthropic exige devolver el thinking block firmado junto al tool_use).
export function stripReasoning(messages: ModelMessage[]): ModelMessage[] {
  return messages.flatMap((m) => {
    if (m.role !== "assistant" || typeof m.content === "string") return [m]
    const content = m.content.filter((p) => p.type !== "reasoning")
    return content.length ? [{ ...m, content }] : []
  })
}

// Cada paso produce un mensaje assistant (en orden): ahí se anota cuánto tardó el paso.
function withDurations(messages: ModelMessage[], ms: number[]): ModelMessage[] {
  let i = 0
  return messages.map((m) => {
    if (m.role !== "assistant") return m
    const d = ms[i++]
    if (typeof m.content === "string" || d === undefined) return m
    return {
      ...m,
      content: m.content.map((p) =>
        p.type === "reasoning"
          ? { ...p, providerOptions: { ...p.providerOptions, [THINK_NS]: { thinkingMs: d } } }
          : p,
      ),
    }
  })
}

const thinkingOptions = (model: LanguageModel) =>
  typeof model === "object" &&
  model.provider.startsWith("anthropic") &&
  !NO_THINKING.test(model.modelId)
    ? { anthropic: { thinking: { type: "enabled" as const, budgetTokens: THINKING_BUDGET } } }
    : undefined

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
  // Default "ask": todo va a la Propuesta.
  approval?: ApprovalLevel
  // Una vez por turno (si algo se auto-aplicó): las Ops aplicadas y sus inversas, en orden de
  // reaplicación (la pila de undo del caller). `inverse` vacío = solo creaciones.
  onApplied?: (ops: Op[], inverse: Op[]) => void
  // Qué tool corre ahora (null = el modelo está pensando): para que la UI diga qué pasa de verdad.
  onTool?: (risk: AgentTool["risk"] | null) => void
  // Texto y razonamiento del paso en curso, acumulados (se reinician en cada paso).
  onStream?: (live: { text: string; reasoning: string }) => void
  // Mensajes de los pasos ya completos (assistant + tool), para pintarlos antes de que cierre el turno.
  onProgress?: (done: ModelMessage[]) => void
  now?: Date
}

export type TurnResult = {
  // Mensajes que produjo el turno (assistant + tool). El caller los appendea al historial.
  messages: ModelMessage[]
  text: string
  steps: number
  // `output` ya incluye los tokens de reasoning; `reasoning` es su parte (0 si no hubo).
  usage: { input: number; output: number; reasoning: number }
  // Ocupación de la ventana tras el turno: input + output del ÚLTIMO step (sin reasoning, que no
  // vuelve al historial). `usage` suma todos los steps y re-cuenta el prompt en cada uno.
  context: number
  // `context` repartido por categoría (estimado; suma = context).
  parts: ContextParts
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
  const applied: Op[] = []
  let inverse: Op[] = []

  const tools = Object.fromEntries(
    input.tools.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: jsonSchema(t.schema),
        execute: async (args) => {
          input.onTool?.(t.risk)
          try {
            return await exec(t, args)
          } finally {
            input.onTool?.(null)
          }
        },
      }),
    ]),
  )

  async function exec(t: AgentTool, args: unknown) {
    const a = args as Record<string, unknown>
    if (t.risk === "read") return t.run(a, ctx)
    // Escribir = proponer: la Op entra a los Borradores y las lecturas siguientes la ven.
    const op = await t.plan(a, ctx)
    if (autoApplies(input.approval ?? "ask", t.risk)) {
      const inv = await applyProposal(input.store, { ops: [op] })
      applied.push(op)
      inverse = [...inv, ...inverse] // orden inverso al de aplicación, como applyProposal
      return `Aplicado: ${op.label}`
    }
    drafts.add(op)
    return `Propuesto (pendiente de aprobación del usuario, aún no aplicado): ${op.label}`
  }

  // Lo completado hasta ahora, para devolverlo parcial si el usuario detiene el turno.
  let done: ModelMessage[] = []
  let count = 0
  const usage = { input: 0, output: 0, reasoning: 0 }
  let context = 0
  const stepMs: number[] = []
  let stepStart = Date.now()
  const system = buildSystemPrompt({ today: dayKey(now), open: input.open ?? null })
  const history = stripReasoning(input.messages)
  const defs = input.tools.map(({ name, description, schema }) => ({ name, description, schema }))
  const parts = (out: ModelMessage[]) => contextParts(system, defs, [...history, ...out], context)
  const propose = () => (drafts.ops().length ? { ops: drafts.ops() } : null)

  try {
    const result = streamText({
      model: input.model,
      instructions: system,
      messages: history,
      providerOptions: thinkingOptions(input.model),
      tools,
      stopWhen: [stepCountIs(MAX_STEPS), malformedCalls],
      abortSignal: input.abortSignal,
      prepareStep: ({ responseMessages }) => {
        done = withDurations(responseMessages, stepMs)
        if (done.length) input.onProgress?.(done)
        stepStart = Date.now()
        return undefined
      },
    })

    // streamText no lanza: los errores y el abort llegan como partes del stream.
    const live = { text: "", reasoning: "" }
    for await (const part of result.fullStream) {
      if (part.type === "error") throw part.error
      if (part.type === "abort") throw new DOMException("aborted", "AbortError")
      if (part.type === "start-step") {
        live.text = ""
        live.reasoning = ""
      } else if (part.type === "finish-step") {
        // Contabilidad acá y no en onStepFinish: ése llega después del cierre del stream, y al
        // detener o fallar el turno se perdería.
        const u = part.usage
        const r = u.outputTokenDetails.reasoningTokens ?? 0
        count++
        stepMs.push(Date.now() - stepStart)
        usage.reasoning += r
        usage.input += u.inputTokens ?? 0
        usage.output += u.outputTokens ?? 0
        context = (u.inputTokens ?? 0) + (u.outputTokens ?? 0) - r
      } else if (part.type === "text-delta" || part.type === "reasoning-delta") {
        live[part.type === "text-delta" ? "text" : "reasoning"] += part.text
        input.onStream?.({ ...live })
      }
    }
    const [steps, responseMessages, totalUsage, finishReason, text] = await Promise.all([
      result.steps,
      result.responseMessages,
      result.totalUsage,
      result.finishReason,
      result.text,
    ])

    const bad = steps.at(-1)?.toolCalls.find((c) => c.invalid)
    const malformed = bad
      ? `${bad.toolName} ${JSON.stringify(bad.input)}: ${bad.error instanceof Error ? bad.error.message : String(bad.error)}`
      : undefined
    const stoppedMalformed = steps.length >= MAX_MALFORMED && malformedCalls({ steps })
    return {
      messages: withDurations(responseMessages, stepMs),
      text,
      steps: steps.length,
      usage: {
        input: totalUsage.inputTokens ?? 0,
        output: totalUsage.outputTokens ?? 0,
        reasoning: totalUsage.outputTokenDetails.reasoningTokens ?? 0,
      },
      context,
      parts: parts(responseMessages),
      finish: stoppedMalformed ? "malformed" : finishReason === "tool-calls" ? "limit" : "stop",
      malformed: stoppedMalformed ? malformed : undefined,
      proposal: propose(),
    }
  } catch (e) {
    if (!input.abortSignal?.aborted) throw e
    return {
      messages: done,
      text: "",
      steps: count,
      usage,
      context,
      parts: parts(done),
      finish: "aborted",
      proposal: propose(),
    }
  } finally {
    // También si el turno falla o se detiene a mitad: lo ya aplicado tiene que poder deshacerse.
    if (applied.length) input.onApplied?.(applied, inverse)
  }
}
