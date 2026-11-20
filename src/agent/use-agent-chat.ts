import { useCallback, useState } from "react"
import type { ModelMessage } from "ai"
import { store } from "@/core/store"
import { createModel, type ProviderConfig } from "@/core/agent/provider"
import type { OpenContext } from "@/core/agent/prompt"
import { runTurn, type TurnResult } from "@/core/agent/turn"
import { agentTools } from "@/agent/tools"

// Cliente fino del núcleo: guarda el hilo (en memoria; recargar lo pierde) y delega cada turno
// a `runTurn`. No sabe de loops, tools ni aprobación.
export function useAgentChat(provider: ProviderConfig) {
  const [messages, setMessages] = useState<ModelMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState<TurnResult | null>(null)

  const send = useCallback(
    async (text: string, open: OpenContext) => {
      const next: ModelMessage[] = [...messages, { role: "user", content: text }]
      setMessages(next)
      setBusy(true)
      setError(null)
      try {
        const turn = await runTurn({
          model: await createModel(provider),
          store,
          tools: agentTools,
          messages: next,
          open,
        })
        setMessages([...next, ...turn.messages])
        setLast(turn)
      } catch (e) {
        // Error crudo del Proveedor (401, CORS, red): el usuario necesita verlo tal cual.
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [messages, provider],
  )

  return { messages, busy, error, last, send }
}
