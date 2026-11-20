import { useEffect, useRef, useState } from "react"
import { useMatch } from "react-router-dom"
import { Bot, Plus, Send, X } from "lucide-react"
import type { ModelMessage } from "ai"
import { Button } from "@/core/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/core/ui/alert-dialog"
import { Textarea } from "@/core/ui/textarea"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { useSnapshot } from "@/core/lib/snapshot"
import type { OpenContext } from "@/core/agent/prompt"
import type { AgentSettings, ProviderConfig } from "@/core/agent/provider"
import { useAgentUi } from "@/agent/agent-ui"
import { AttachMenu, type Picked } from "@/agent/attach-menu"
import { ChatMarkdown } from "@/agent/chat-markdown"
import { ProposalCard } from "@/agent/proposal-card"
import { useAgentChat } from "@/agent/use-agent-chat"
import { ApprovalPicker } from "@/agent/approval-picker"
import { ModelPicker } from "@/agent/model-picker"
import { useAgentSettings } from "@/agent/use-provider"

// Qué tiene abierto el usuario, según la ruta: la nota (con notebook o suelta) o el notebook.
function useOpenContext(): OpenContext {
  const inNote = useMatch("/notebook/:id/:noteId")
  const inNotebook = useMatch("/notebook/:id")
  const standalone = useMatch("/note/:id")
  const noteId = inNote?.params.noteId ?? standalone?.params.id
  const notebookId = inNote?.params.id ?? inNotebook?.params.id
  const { data } = useSnapshot((s): OpenContext => {
    const note = noteId ? s.notes.find((n) => n.id === noteId) : undefined
    if (note) return { kind: "nota", id: note.id, title: note.title }
    const nb = notebookId ? s.notebooks.find((n) => n.id === notebookId) : undefined
    return nb ? { kind: "notebook", id: nb.id, title: nb.name } : null
  })
  return data ?? null
}

function Thread({ messages }: { messages: ModelMessage[] }) {
  return messages.map((m, i) => {
    if (m.role === "user")
      return (
        <p key={i} className="self-end rounded-2xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
          {typeof m.content === "string"
            ? m.content
            : m.content.map((p) => (p.type === "text" ? p.text : "")).slice(0, 1)}
          {Array.isArray(m.content) && m.content.length > 1 && (
            <span className="mono-dim block">adjuntos: {m.content.length - 1}</span>
          )}
        </p>
      )
    if (m.role !== "assistant" || typeof m.content === "string")
      return m.role === "assistant" ? (
        <ChatMarkdown key={i}>{m.content as string}</ChatMarkdown>
      ) : null
    return (
      <div key={i} className="flex flex-col gap-1">
        {m.content.map((part, j) =>
          part.type === "text" ? (
            <ChatMarkdown key={j}>{part.text}</ChatMarkdown>
          ) : part.type === "tool-call" ? (
            <span key={j} className="mono-dim">
              · {part.toolName}
            </span>
          ) : null,
        )}
      </div>
    )
  })
}

function Chat({
  provider,
  modelId,
  settings,
}: {
  provider: ProviderConfig
  modelId: string
  settings: AgentSettings
}) {
  const {
    messages,
    busy,
    error,
    last,
    proposal,
    send,
    approve,
    discard,
    undoable,
    blocked,
    undo,
    reset,
    hasApplied,
  } = useAgentChat(provider, modelId)
  const [confirmReset, setConfirmReset] = useState(false)
  const open = useOpenContext()
  const [chipOff, setChipOff] = useState(false)
  const [draft, setDraft] = useState("")
  const [picked, setPicked] = useState<Picked[]>([])
  const end = useRef<HTMLDivElement>(null)
  // El chip quitado vuelve cuando cambia lo abierto: es contexto por turno, no preferencia.
  const openId = open?.id
  useEffect(() => setChipOff(false), [openId])
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages, busy, error, proposal])

  function submit() {
    const text = draft.trim()
    if (!text || busy) return
    setDraft("")
    setPicked([])
    void send(
      text,
      chipOff ? null : open,
      picked.map((p) => p.attachment),
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {messages.length > 0 && (
        <div className="flex shrink-0 justify-end border-b px-3 py-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => (hasApplied() ? setConfirmReset(true) : reset())}
          >
            <Plus /> Nuevo chat
          </Button>
        </div>
      )}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Empezar un chat nuevo?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya se aplicaron cambios en este chat. Si seguís, ya no vas a poder deshacerlos desde
              acá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={reset}>Nuevo chat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Pedime que explore tus notebooks, notas y hábitos. Si quiero cambiar algo, te lo
            propongo y vos aprobás o descartás.
          </p>
        )}
        <Thread messages={messages} />
        {proposal && (
          <ProposalCard
            proposal={proposal.value}
            status={proposal.status}
            onApprove={(edited) => void approve(edited)}
            onDiscard={discard}
          />
        )}
        {undoable.length > 0 && !busy && (
          <div className="flex flex-col gap-2 rounded-xl border p-3 text-sm">
            <span className="mono-dim">Último cambio aplicado: {undoable.join(" · ")}</span>
            {blocked && (
              <p role="alert" className="text-destructive">
                Esto cambió desde que se aplicó: {blocked.join(", ")}
              </p>
            )}
            <div className="flex gap-2">
              {blocked ? (
                <Button size="sm" variant="destructive" onClick={() => void undo(true)}>
                  Deshacer igual
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void undo()}>
                  Deshacer
                </Button>
              )}
            </div>
          </div>
        )}
        {busy && <span className="mono-dim">pensando…</span>}
        {error && (
          <p role="alert" className="text-sm break-words text-destructive">
            {error}
          </p>
        )}
        {last && !busy && (
          <span
            className="mono-dim"
            title={`${last.usage.input} entrada · ${last.usage.output} salida · ${last.steps} pasos · ${modelId}`}
          >
            {last.usage.input + last.usage.output} tokens
            {last.finish === "limit" && " · llegué al límite de pasos"}
          </span>
        )}
        <div ref={end} />
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t p-3">
        {open && !chipOff && (
          <span className="flex w-fit max-w-full items-center gap-1 rounded-pill bg-muted py-0.5 pr-1 pl-3 text-xs">
            <span className="truncate">{open.title || "(sin título)"}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Quitar contexto"
              onClick={() => setChipOff(true)}
            >
              <X />
            </Button>
          </span>
        )}
        {picked.map((p, i) => (
          <span
            key={i}
            className="flex w-fit max-w-full items-center gap-1 rounded-pill bg-muted py-0.5 pr-1 pl-3 text-xs"
          >
            <span className="truncate">{p.label}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Quitar adjunto"
              onClick={() => setPicked((l) => l.filter((_, j) => j !== i))}
            >
              <X />
            </Button>
          </span>
        ))}
        <div className="flex items-end gap-2">
          <AttachMenu model={modelId} onPick={(p) => setPicked((l) => [...l, p])} />
          <Textarea
            aria-label="Mensaje al Agente"
            rows={1}
            value={draft}
            placeholder="Preguntale al Agente…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            className="max-h-40 min-h-9 flex-1 resize-none"
          />
          <Button size="icon" aria-label="Enviar" disabled={busy || !draft.trim()} onClick={submit}>
            <Send />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ModelPicker settings={settings} active={{ provider, modelId }} />
          <ApprovalPicker />
        </div>
      </div>
    </div>
  )
}

// Contenido del Agente (sidebar propio o pestaña del notebook). Es el chunk lazy: el AI SDK
// baja recién la primera vez que se abre.
export default function AgentPanel() {
  const { settings, active } = useAgentSettings()
  const { openSettings } = useAgentUi()
  if (!active)
    return (
      <Empty>
        <EmptyHeader>
          <Bot className="size-6 text-muted-foreground" />
          <EmptyTitle>Sin Proveedor</EmptyTitle>
          <EmptyDescription>
            Configurá un Proveedor (Anthropic, OpenRouter o uno compatible con OpenAI) para hablar
            con el Agente. Las keys viven solo en este navegador.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={openSettings}>Configurar Proveedor</Button>
        </EmptyContent>
      </Empty>
    )
  // key: cambiar de Proveedor/modelo arranca un hilo limpio.
  return (
    <Chat
      key={`${active.provider.id}:${active.modelId}`}
      provider={active.provider}
      modelId={active.modelId}
      settings={settings}
    />
  )
}
