import type { ModelMessage } from "ai"
import type { Caps } from "@/core/agent/capabilities"
import { asData } from "@/core/agent/prompt"

// Adjuntos del `+` del composer (ticket 07): efímeros, viven en el hilo (el mensaje del usuario),
// nunca se guardan. Todo texto entra envuelto como DATO; las imágenes van como parte de imagen.
export type Attachment =
  | {
      kind: "text"
      tag: string
      attrs: Record<string, string | number | null>
      body: string
    }
  | { kind: "image"; name: string; mediaType: string; data: string } // data = base64

// Desconocido = capaz: solo un `vision: false` explícito (ticket 08) deshabilita las imágenes.
export function supportsVision(caps?: Caps) {
  return caps?.vision !== false
}

// Un Skill invocado viaja como INSTRUCCIÓN del turno (segunda parte del mensaje), no como DATO:
// es texto del propio usuario. El `text` original (`/nombre args`) queda primero para mostrarlo.
export const SKILL_TAG = "skill"

export function userMessage(
  text: string,
  attachments: Attachment[] = [],
  skill?: { name: string; prompt: string; args: string },
): ModelMessage {
  if (attachments.length === 0 && !skill) return { role: "user", content: text }
  const instruction = skill
    ? [
        {
          type: "text" as const,
          text: asData(
            SKILL_TAG,
            { nombre: skill.name },
            skill.args ? `${skill.prompt}\n\nArgumentos: ${skill.args}` : skill.prompt,
          ),
        },
      ]
    : []
  const parts = attachments.flatMap((a) =>
    a.kind === "text"
      ? [{ type: "text" as const, text: asData(a.tag, a.attrs, a.body) }]
      : [
          {
            type: "text" as const,
            text: asData("adjunto", { nombre: a.name, tipo: "imagen" }),
          },
          { type: "file" as const, data: a.data, mediaType: a.mediaType },
        ],
  )
  return { role: "user", content: [{ type: "text", text }, ...instruction, ...parts] }
}
