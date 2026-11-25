import { useCallback, useMemo, useRef, useState } from "react"
import { setStored, useStored } from "@/core/lib/hooks/use-stored"
import { parseChats, upsertChat, type Meter } from "@/core/agent/chats"
import type { ModelMessage } from "ai"
import { useQueryClient } from "@tanstack/react-query"
import { store } from "@/core/store"
import { notifyExternalWrite } from "@/core/lib/snapshot"
import { createModel, type ProviderConfig } from "@/core/agent/provider"
import { userMessage, type Attachment } from "@/core/agent/attachments"
import { matchSkill } from "@/core/agent/skills"
import type { OpenContext } from "@/core/agent/prompt"
import type { Proposal } from "@/core/agent/proposal"
import { createSession, type UndoResult } from "@/core/agent/session"
import { runTurn, type TurnResult } from "@/core/agent/turn"
import { useApprovalLevel } from "@/agent/approval-picker"
import type { AgentTool } from "@/core/agent/tool"
import { agentTools } from "@/agent/tools"
import { useSkills } from "@/agent/use-skills"

export const CHATS_KEY = "agent.chats"

// Cliente fino del núcleo: guarda el hilo (los mensajes persisten en localStorage como Chat;
// undo y Propuesta no) y delega cada turno a `runTurn`. No sabe de loops, tools ni aprobación.
export function useAgentChat(provider: ProviderConfig, modelId: string) {
  const [messages, setMessages] = useState<ModelMessage[]>([])
  const [chatId, setChatId] = useState<string>(() => crypto.randomUUID())
  const raw = useStored(CHATS_KEY)
  const chats = useMemo(() => parseChats(raw), [raw])
  // Chats borrados: un turno en vuelo no debe resucitarlos al terminar.
  const deleted = useRef(new Set<string>())
  const persist = useCallback((id: string, msgs: ModelMessage[], meter?: Meter) => {
    if (deleted.current.has(id)) return
    const prev = parseChats(localStorage.getItem(CHATS_KEY))
    setStored(CHATS_KEY, JSON.stringify(upsertChat(prev, id, msgs, Date.now(), meter)))
  }, [])
  const [busy, setBusy] = useState(false)
  // Qué hace el Agente ahora: null = el modelo piensa; si no, el riesgo de la tool en curso.
  const [tool, setTool] = useState<AgentTool["risk"] | null>(null)
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
  // Anillo de contexto: último turno + tokens acumulados del chat. Persiste con el Chat.
  const [meter, setMeter] = useState<Meter | null>(null)
  const abort = useRef<AbortController | null>(null)
  const qc = useQueryClient()
  const syncUndo = useCallback(
    () => setUndoable(session.canUndo() ? session.last() : []),
    [session],
  )
  const approval = useApprovalLevel()
  const skills = useSkills()

  const refresh = useCallback(() => {
    void qc.invalidateQueries()
    notifyExternalWrite()
  }, [qc])

  const send = useCallback(
    async (text: string, open: OpenContext, attachments: Attachment[] = []) => {
      // `/nombre args` expande el Skill como instrucción del turno; un `/foo` inexistente va como texto.
      const hit = matchSkill(text, skills)
      const next: ModelMessage[] = [
        ...messages,
        userMessage(text, attachments, hit ? { ...hit.skill, args: hit.args } : undefined),
      ]
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
          onTool: setTool,
          onApplied: (ops, inverse) => {
            session.pushApplied(ops, inverse)
            syncUndo()
          },
          abortSignal: ctl.signal,
        })
        // Borrado a mitad del turno: ni se persiste ni se pinta en el chat nuevo.
        if (deleted.current.has(chatId)) return
        const done = [...next, ...turn.messages]
        const m: Meter = {
          context: turn.context,
          parts: turn.parts,
          last: { input: turn.usage.input, output: turn.usage.output },
          session: {
            input: (meter?.session.input ?? 0) + turn.usage.input,
            output: (meter?.session.output ?? 0) + turn.usage.output,
          },
        }
        setMessages(done)
        persist(chatId, done, m)
        setMeter(m)
        setLast(turn)
        if (turn.finish === "malformed") setMalformed(turn.malformed ?? "")
        if (turn.proposal) setProposal({ value: turn.proposal, status: "pending" })
      } catch (e) {
        if (deleted.current.has(chatId)) return // el abort del borrado no es un error
        // Error crudo del Proveedor (401, CORS, red): el usuario necesita verlo tal cual.
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        // Puede haber auto-aplicado escrituras: la UI relee.
        refresh()
        setTool(null)
        setBusy(false)
      }
    },
    [
      messages,
      chatId,
      persist,
      provider,
      modelId,
      approval,
      refresh,
      session,
      syncUndo,
      skills,
      meter,
    ],
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
      refresh()
    },
    [proposal, refresh, session, syncUndo],
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
      refresh()
    },
    [refresh, session, syncUndo],
  )

  // Vacía lo efímero del hilo actual (undo, Propuesta) y carga mensajes + anillo dados.
  const load = useCallback(
    (id: string, msgs: ModelMessage[], m: Meter | null = null) => {
      session.clear()
      setChatId(id)
      setMeter(m)
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
      if (c && canSwitch) load(c.id, c.messages, c.meter)
    },
    [chats, canSwitch, load],
  )

  // Borrar: si era el activo pasa a uno nuevo.
  const remove = useCallback(
    (id: string) => {
      deleted.current.add(id)
      setStored(CHATS_KEY, JSON.stringify(chats.filter((c) => c.id !== id)))
      if (id === chatId) {
        abort.current?.abort()
        reset()
      }
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
    tool,
    error,
    malformed,
    meter,
    tokens: meter?.session ?? { input: 0, output: 0 },
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
