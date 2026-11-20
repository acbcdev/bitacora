import { useEffect, useRef, useState } from "react"
import { useMatch } from "react-router-dom"
import { Bot, Send, X } from "lucide-react"
import type { ModelMessage } from "ai"
import { Button } from "@/core/ui/button"
import { Textarea } from "@/core/ui/textarea"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { useSnapshot } from "@/core/lib/snapshot"
import type { OpenContext } from "@/core/agent/prompt"
import type { ProviderConfig } from "@/core/agent/provider"
import { useAgentUi } from "@/agent/agent-ui"
import { ChatMarkdown } from "@/agent/chat-markdown"
import { ProposalCard } from "@/agent/proposal-card"
import { useAgentChat } from "@/agent/use-agent-chat"
import { useProvider } from "@/agent/use-provider"

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
          {typeof m.content === "string" ? m.content : ""}
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

function Chat({ provider }: { provider: ProviderConfig }) {
  const { messages, busy, error, last, proposal, send, approve, discard } = useAgentChat(provider)
  const open = useOpenContext()
  const [chipOff, setChipOff] = useState(false)
  const [draft, setDraft] = useState("")
  const end = useRef<HTMLDivElement>(null)
  // El chip quitado vuelve cuando cambia lo abierto: es contexto por turno, no preferencia.
  const openId = open?.id
  useEffect(() => setChipOff(false), [openId])
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages, busy, error, proposal])

  function submit() {
    const text = draft.trim()
    if (!text || busy) return
    setDraft("")
    void send(text, chipOff ? null : open)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
            onApprove={() => void approve()}
            onDiscard={discard}
          />
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
            title={`${last.usage.input} entrada · ${last.usage.output} salida · ${last.steps} pasos · ${provider.model}`}
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
        <div className="flex items-end gap-2">
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
        <span className="mono-dim">{provider.model}</span>
      </div>
    </div>
  )
}

// Contenido del Agente (sidebar propio o pestaña del notebook). Es el chunk lazy: el AI SDK
// baja recién la primera vez que se abre.
export default function AgentPanel() {
  const provider = useProvider()
  const { openSettings } = useAgentUi()
  if (!provider)
    return (
      <Empty>
        <EmptyHeader>
          <Bot className="size-6 text-muted-foreground" />
          <EmptyTitle>Sin Proveedor</EmptyTitle>
          <EmptyDescription>
            Configurá tu key de Anthropic para hablar con el Agente. Vive solo en este navegador.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={openSettings}>Configurar Proveedor</Button>
        </EmptyContent>
      </Empty>
    )
  // key: cambiar de Proveedor/modelo arranca un hilo limpio.
  return <Chat key={`${provider.kind}:${provider.model}`} provider={provider} />
}
