import { setStored } from "@/core/lib/hooks/use-stored"
import type { ToolRisk } from "@/core/agent/tool"

// Nivel de aprobación: cuánto pregunta el Agente. Por dispositivo (localStorage), como el Proveedor.
export type ApprovalLevel = "ask" | "review" | "skip"

export const APPROVAL_LEVELS: { id: ApprovalLevel; name: string }[] = [
  { id: "ask", name: "Preguntar siempre" },
  { id: "review", name: "Revisar para mí" },
  { id: "skip", name: "Omitir aprobaciones" },
]

export const APPROVAL_KEY = "bita-agent-approval"

// ¿Se aplica sin pasar por la Propuesta? `ask` nunca; `review` solo lo aditivo; `skip` todo.
export function autoApplies(level: ApprovalLevel, risk: ToolRisk): boolean {
  return level === "skip" || (level === "review" && risk === "safe")
}

export function parseApprovalLevel(raw: string | null): ApprovalLevel {
  return APPROVAL_LEVELS.some((l) => l.id === raw) ? (raw as ApprovalLevel) : "ask"
}

export function saveApprovalLevel(level: ApprovalLevel) {
  setStored(APPROVAL_KEY, level)
}
