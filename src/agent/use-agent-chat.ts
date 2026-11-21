import { useCallback, useMemo, useRef, useState } from "react"
import { setStored, useStored } from "@/core/lib/hooks/use-stored"
import { parseChats, upsertChat } from "@/core/agent/chats"
import type { ModelMessage } from "ai"
import { useQueryClient } from "@tanstack/react-query"
import { store } from "@/core/store"
import { createModel, type ProviderConfig } from "@/core/agent/provider"
import { userMessage, type Attachment } from "@/core/agent/attachments"
import type { OpenContext } from "@/core/agent/prompt"
import type { Proposal } from "@/core/agent/proposal"
import { createSession, type UndoResult } from "@/core/agent/session"
import { runTurn, type TurnResult } from "@/core/agent/turn"
import { useApprovalLevel } from "@/agent/approval-picker"
import { agentTools } from "@/agent/tools"

export const CHATS_KEY = "agent.chats"

// Cliente fino del núcleo: guarda el hilo (los mensajes persisten en localStorage como Chat;
// undo y Propuesta no) y delega cada turno a `runTurn`. No sabe de loops, tools ni aprobación.
export function useAgentChat(provider: ProviderConfig, modelId: string) {
  const [messages, setMessages] = useState<ModelMessage[]>([])
  const [chatId, setChatId] = useState<string>(() => crypto.randomUUID())
  const raw = useStored(CHATS_KEY)
  const chats = useMemo(() => parseChats(raw), [raw])
  const persist = useCallback(
    (id: string, msgs: ModelMessage[]) =>
      setStored(
        CHATS_KEY,
        JSON.stringify(
          upsertChat(parseChats(localStorage.getItem(CHATS_KEY)), id, msgs, Date.now()),
        ),
      ),
    [],
  )
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
  // La pila de undo vive con el hilo: "Nuevo chat" y recargar la pierden.
  const session = useMemo(() => createSession(store), [])
  const [undoable, setUndoable] = useState<string[]>([])
  const [blocked, setBlocked] = useState<string[] | null>(null)
  // Tokens acumulados de la sesión (sin dólares). "Nuevo chat" los limpia (en `reset`).
  const [tokens, setTokens] = useState({ input: 0, output: 0 })
  const abort = useRef<AbortController | null>(null)
  const qc = useQueryClient()
  const syncUndo = useCallback(
    () => setUndoable(session.canUndo() ? session.last() : []),
    [session],
  )
  const approval = useApprovalLevel()

  const send = useCallback(
    async (text: string, open: OpenContext, attachments: Attachment[] = []) => {
      const next: ModelMessage[] = [...messages, userMessage(text, attachments)]
      setMessages(next)
      persist(chatId, next)
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
          approval,
          onApplied: (ops, inverse) => {
            session.pushApplied(ops, inverse)
            syncUndo()
          },
          abortSignal: ctl.signal,
        })
        setMessages([...next, ...turn.messages])
        persist(chatId, [...next, ...turn.messages])
        setLast(turn)
        setTokens((t) => ({
          input: t.input + turn.usage.input,
          output: t.output + turn.usage.output,
        }))
        if (turn.finish === "malformed") setMalformed(turn.malformed ?? "")
        if (turn.proposal) setProposal({ value: turn.proposal, status: "pending" })
      } catch (e) {
        // Error crudo del Proveedor (401, CORS, red): el usuario necesita verlo tal cual.
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        // Puede haber auto-aplicado escrituras: la UI relee.
        void qc.invalidateQueries()
        setBusy(false)
      }
    },
    [messages, chatId, persist, provider, modelId, approval, qc, session, syncUndo],
  )

  const stop = useCallback(() => abort.current?.abort(), [])

  // `edited` = la Propuesta con los cuerpos que el usuario tocó en la pestaña Cambios.
  const approve = useCallback(
    async (edited?: Proposal) => {
      if (proposal?.status !== "pending") return
      try {
        await session.apply(edited ?? proposal.value)
        setProposal({ ...proposal, status: "applied" })
        setBlocked(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
      syncUndo()
      // Aplicó total o parcialmente: la UI relee de todos modos.
      void qc.invalidateQueries()
    },
    [proposal, qc, session, syncUndo],
  )

  const undo = useCallback(
    async (force = false) => {
      try {
        const r: UndoResult = await session.undo({ force })
        setBlocked(r.status === "changed" ? r.labels : null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
      syncUndo()
      void qc.invalidateQueries()
    },
    [qc, session, syncUndo],
  )

  // Vacía lo efímero del hilo actual (undo, Propuesta, tokens) y deja los mensajes dados.
  const load = useCallback(
    (id: string, msgs: ModelMessage[]) => {
      session.clear()
      setChatId(id)
      setTokens({ input: 0, output: 0 })
      setMalformed(null)
      setMessages(msgs)
      setProposal(null)
      setLast(null)
      setError(null)
      setBlocked(null)
      setUndoable([])
    },
    [session],
  )

  const reset = useCallback((id: string = crypto.randomUUID()) => load(id, []), [load])

  // Cambiar de chat: no con el Agente ocupado ni con una Propuesta pendiente (se perdería).
  const canSwitch = !busy && proposal?.status !== "pending"
  const openChat = useCallback(
    (id: string) => {
      const c = chats.find((x) => x.id === id)
      if (c && canSwitch) load(c.id, c.messages)
    },
    [chats, canSwitch, load],
  )

  // Borrar: si era el activo pasa a uno nuevo.
  const remove = useCallback(
    (id: string) => {
      setStored(CHATS_KEY, JSON.stringify(chats.filter((c) => c.id !== id)))
      if (id === chatId) reset()
    },
    [chats, chatId, reset],
  )

  const discard = useCallback(() => {
    if (proposal?.status === "pending") setProposal({ ...proposal, status: "discarded" })
  }, [proposal])

  return {
    messages,
    chatId,
    chats,
    canSwitch,
    openChat,
    remove,
    busy,
    error,
    malformed,
    tokens,
    stop,
    last,
    proposal,
    send,
    approve,
    discard,
    undoable,
    blocked,
    undo,
    reset,
    hasApplied: () => session.hasApplied(),
  }
}
