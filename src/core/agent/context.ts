import type { ModelMessage } from "ai"
import { SKILL_TAG } from "@/core/agent/attachments"

export type ContextPart = "system" | "tools" | "skills" | "attachments" | "messages" | "toolResults"
export type ContextParts = Record<ContextPart, number>

// Una imagen no se mide por sus chars en base64: ~1.6k tokens es lo típico.
const IMAGE = 6_400

const size = (x: unknown) => (typeof x === "string" ? x.length : (JSON.stringify(x)?.length ?? 0))

// Reparte el total REAL (`total`, lo que reportó el proveedor) entre categorías según su peso en
// chars. ponytail: chars como proxy de tokens solo para proporciones; un tokenizer por proveedor
// daría más precisión pero el total ya es exacto.
export function contextParts(
  system: string,
  tools: unknown,
  messages: ModelMessage[],
  total: number,
): ContextParts {
  const c: ContextParts = {
    system: system.length,
    tools: size(tools),
    skills: 0,
    attachments: 0,
    messages: 0,
    toolResults: 0,
  }
  for (const m of messages) {
    if (m.role === "system") c.system += m.content.length
    else if (m.role === "tool") c.toolResults += size(m.content)
    else if (typeof m.content === "string") c.messages += m.content.length
    else
      m.content.forEach((p, i) => {
        if (p.type === "text") {
          // userMessage(): parte 0 = lo que tipeó; <skill> = instrucción; el resto = adjuntos.
          if (m.role === "user" && p.text.startsWith(`<${SKILL_TAG}`)) c.skills += p.text.length
          else if (m.role === "user" && i > 0) c.attachments += p.text.length
          else c.messages += p.text.length
        } else if (p.type === "file" || p.type === "image") c.attachments += IMAGE
        else if (p.type === "tool-call" || p.type === "tool-result") c.toolResults += size(p)
        else if (p.type !== "reasoning") c.messages += size(p) // reasoning no vuelve al prompt
      })
  }
  const sum = Object.values(c).reduce((a, b) => a + b, 0) || 1
  for (const k of Object.keys(c) as ContextPart[]) c[k] = Math.round((c[k] / sum) * total)
  return c
}
