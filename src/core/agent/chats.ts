import type { ModelMessage } from "ai"
import type { ContextParts } from "@/core/agent/context"

type Tokens = { input: number; output: number }
// Lo que pinta el anillo de contexto tras el último turno; persiste para que reabrir un chat lo
// muestre. Al reabrir puede quedar algo alto: los resultados de tools se guardan truncados.
export type Meter = { context: number; parts: ContextParts; last: Tokens; session: Tokens }

// Un Chat guardado (solo en este dispositivo, ADR 0028). Persisten `messages` y `meter`;
// la pila de undo y la Propuesta pendiente son efímeras.
export type Chat = {
  id: string
  createdAt: number
  updatedAt: number
  messages: ModelMessage[]
  meter?: Meter
}

export const MAX_CHATS = 20
export const MAX_RESULT = 2000

// Título = la primera pregunta del usuario.
export function chatTitle(messages: ModelMessage[]) {
  const m = messages.find((x) => x.role === "user")
  if (!m) return "Nuevo chat"
  const t =
    typeof m.content === "string"
      ? m.content
      : m.content.map((p) => (p.type === "text" ? p.text : "")).join("")
  return t.trim() || "Nuevo chat"
}

function cut(s: string) {
  return s.length > MAX_RESULT ? `${s.slice(0, MAX_RESULT)}… [truncado]` : s
}

// Resultados grandes de tools se guardan cortados (pueden pesar mucho en localStorage).
export function truncateResults(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((m) => {
    if (m.role !== "tool") return m
    return {
      ...m,
      content: m.content.map((p) => {
        if (p.type !== "tool-result") return p
        const o = p.output as { type: string; value?: unknown }
        if (typeof o.value === "string")
          return o.value.length > MAX_RESULT
            ? { ...p, output: { ...o, value: cut(o.value) } as typeof p.output }
            : p
        const json = JSON.stringify(o.value ?? null)
        return json.length > MAX_RESULT
          ? {
              ...p,
              // Texto plano, pero conservando si era un error: la UI lo lee al reabrir el chat.
              output: {
                type: o.type === "error-json" ? "error-text" : "text",
                value: cut(json),
              } as typeof p.output,
            }
          : p
      }),
    }
  })
}

export function parseChats(raw: string | null): Chat[] {
  try {
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

// Más reciente primero; al pasar el tope cae el más viejo.
// Sin `meter` (el mensaje del usuario, antes del turno) se conserva el anterior.
export function upsertChat(
  chats: Chat[],
  id: string,
  messages: ModelMessage[],
  now: number,
  meter?: Meter,
) {
  const prev = chats.find((c) => c.id === id)
  const m = meter ?? prev?.meter
  const chat: Chat = {
    id,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    messages: truncateResults(messages),
    ...(m && { meter: m }),
  }
  return [chat, ...chats.filter((c) => c.id !== id)].slice(0, MAX_CHATS)
}

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]

// "hoy", "ayer", día de la semana (últimos 6 días) o dd/mm.
export function relativeDay(ts: number, now: number) {
  const d = new Date(ts)
  const days = Math.round(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86_400_000,
  )
  if (days <= 0) return "hoy"
  if (days === 1) return "ayer"
  if (days < 7) return DAYS[d.getDay()]
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}
