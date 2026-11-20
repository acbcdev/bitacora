import { useCallback, useRef, useState } from "react"
import type { ModelMessage } from "ai"
import { useQueryClient } from "@tanstack/react-query"
import { store } from "@/core/store"
import { createModel, type ProviderConfig } from "@/core/agent/provider"
import { userMessage, type Attachment } from "@/core/agent/attachments"
import type { OpenContext } from "@/core/agent/prompt"
import { applyProposal, type Proposal } from "@/core/agent/proposal"
import { runTurn, type TurnResult } from "@/core/agent/turn"
import { agentTools } from "@/agent/tools"

// Cliente fino del núcleo: guarda el hilo (en memoria; recargar lo pierde) y delega cada turno
// a `runTurn`. No sabe de loops, tools ni aprobación.
export function useAgentChat(provider: ProviderConfig, modelId: string) {
  const [messages, setMessages] = useState<ModelMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Detalle crudo del tool-call inválido que agotó los reintentos (línea de error colapsable).
  const [malformed, setMalformed] = useState<string | null>(null)
  const [last, setLast] = useState<TurnResult | null>(null)
  // La Propuesta del último turno. Un mensaje nuevo la reemplaza: los Borradores eran de ese turno.
  const [proposal, setProposal] = useState<{
    value: Proposal
    status: "pending" | "applied" | "discarded"
  } | null>(null)
  // Tokens acumulados de la sesión (sin dólares). "Nuevo chat" lo limpia con `resetSession`.
  const [session, setSession] = useState({ input: 0, output: 0 })
  const abort = useRef<AbortController | null>(null)
  const qc = useQueryClient()

  const send = useCallback(
    async (text: string, open: OpenContext, attachments: Attachment[] = []) => {
      const next: ModelMessage[] = [...messages, userMessage(text, attachments)]
      setMessages(next)
      setBusy(true)
      setError(null)
      setMalformed(null)
      setProposal(null)
      const ctl = new AbortController()
      abort.current = ctl
      try {
        const turn = await runTurn({
          model: await createModel(provider, modelId),
          store,
          tools: agentTools,
          messages: next,
          open,
          abortSignal: ctl.signal,
        })
        setMessages([...next, ...turn.messages])
        setLast(turn)
        setSession((t) => ({
          input: t.input + turn.usage.input,
          output: t.output + turn.usage.output,
        }))
        if (turn.finish === "malformed") setMalformed(turn.malformed ?? "")
        if (turn.proposal) setProposal({ value: turn.proposal, status: "pending" })
      } catch (e) {
        // Error crudo del Proveedor (401, CORS, red): el usuario necesita verlo tal cual.
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [messages, provider, modelId],
  )

  const stop = useCallback(() => abort.current?.abort(), [])
  const resetSession = useCallback(() => setSession({ input: 0, output: 0 }), [])

  const approve = useCallback(async () => {
    if (proposal?.status !== "pending") return
    try {
      await applyProposal(store, proposal.value)
      setProposal({ ...proposal, status: "applied" })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    // Aplicó total o parcialmente: la UI relee de todos modos.
    void qc.invalidateQueries()
  }, [proposal, qc])

  const discard = useCallback(() => {
    if (proposal?.status === "pending") setProposal({ ...proposal, status: "discarded" })
  }, [proposal])

  return {
    messages,
    busy,
    error,
    malformed,
    last,
    session,
    proposal,
    send,
    stop,
    resetSession,
    approve,
    discard,
  }
}
