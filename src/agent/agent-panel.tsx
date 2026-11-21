import { useEffect, useRef, useState } from "react"
import { useMatch } from "react-router-dom"
import { Bot, Send, Square, SquarePen, X } from "lucide-react"
import { toast } from "sonner"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { useSnapshot } from "@/core/lib/snapshot"
import type { OpenContext } from "@/core/agent/prompt"
import type { AgentSettings, ProviderConfig } from "@/core/agent/provider"
import { useAgentUi } from "@/agent/agent-ui"
import { AttachMenu, addPicked, usePickRef, type Picked } from "@/agent/attach-menu"
import { ChatMarkdown } from "@/agent/chat-markdown"
import { MentionMenu, useMention } from "@/agent/mention-menu"
import { ToolBlock } from "@/agent/tool-block"
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

// Resultado de cada tool-call (viene en un mensaje `tool` aparte, por toolCallId).
function toolResults(messages: ModelMessage[]) {
  const out = new Map<string, string>()
  for (const m of messages)
    if (m.role === "tool")
      for (const p of m.content)
        if (p.type === "tool-result") {
          const v = (p.output as { value?: unknown }).value
          out.set(p.toolCallId, typeof v === "string" ? v : JSON.stringify(v ?? p.output, null, 2))
        }
  return out
}

// Título del chat: la primera pregunta del usuario.
function chatTitle(messages: ModelMessage[]) {
  const m = messages.find((x) => x.role === "user")
  if (!m) return "Nuevo chat"
  const t =
    typeof m.content === "string"
      ? m.content
      : m.content.map((p) => (p.type === "text" ? p.text : "")).join("")
  return t.trim() || "Nuevo chat"
}

function Thread({ messages, busy }: { messages: ModelMessage[]; busy: boolean }) {
  const results = toolResults(messages)
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
      <div key={i} className="flex flex-col gap-2">
        {m.content.map((part, j) =>
          part.type === "text" ? (
            <ChatMarkdown key={j}>{part.text}</ChatMarkdown>
          ) : part.type === "tool-call" ? (
            <ToolBlock
              key={j}
              name={part.toolName}
              input={part.input}
              result={results.get(part.toolCallId)}
              busy={busy}
            />
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
    malformed,
    last,
    tokens,
    proposal,
    send,
    stop,
    approve,
    discard,
    undoable,
    blocked,
    undo,
    reset,
    hasApplied,
  } = useAgentChat(provider, modelId)
  const [confirmReset, setConfirmReset] = useState(false)
  const caps = provider.models.find((m) => m.id === modelId)?.caps
  const isMobile = useIsMobile()
  // Mobile: el toast con Deshacer sobrevive al Drawer (el chat vive en AgentHost, no en el Drawer).
  const applied = proposal?.status === "applied"
  useEffect(() => {
    if (!isMobile || !applied) return
    toast("Cambios aplicados", {
      description: undoable.join(" · "),
      duration: 8000,
      action: { label: "Deshacer", onClick: () => void undo() },
    })
    // Solo al pasar a "applied": undoable/undo cambian después sin ser un cambio nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied])
  const open = useOpenContext()
  const [chipOff, setChipOff] = useState(false)
  const [draft, setDraft] = useState("")
  const [picked, setPicked] = useState<Picked[]>([])
  const [caret, setCaret] = useState(0)
  const pickRef = usePickRef((p) => setPicked((l) => addPicked(l, p)))
  const mention = useMention(
    draft,
    caret,
    (a, b) => setDraft((d) => d.slice(0, a) + d.slice(b)),
    (o) => void pickRef({ kind: o.kind, id: o.id }, o.label || "(sin título)"),
  )
  const end = useRef<HTMLDivElement>(null)
  // El chip quitado vuelve cuando cambia lo abierto: es contexto por turno, no preferencia.
  const openId = open?.id
  useEffect(() => {
    setChipOff(false)
  }, [openId])
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages, busy, error, proposal])

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
      <header className="flex h-12 shrink-0 items-center gap-2 px-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted">
          <Bot className="size-3.5" />
        </span>
        <h2 className="truncate text-sm font-medium">{chatTitle(messages)}</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Nuevo chat"
              className="ml-auto shrink-0"
              disabled={busy || messages.length === 0}
              onClick={() => (hasApplied() ? setConfirmReset(true) : reset())}
            >
              <SquarePen />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Nuevo chat</TooltipContent>
        </Tooltip>
      </header>
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
          <div className="flex flex-1 flex-col justify-end gap-2 pb-2">
            <h3 className="text-lg font-medium">¿En qué te ayudo?</h3>
            <p className="text-sm text-muted-foreground">
              Pedime que explore tus notebooks, notas y hábitos. Si quiero cambiar algo, te lo
              propongo y vos aprobás o descartás.
            </p>
          </div>
        )}
        <Thread messages={messages} busy={busy} />
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
        {malformed !== null && (
          <details className="text-xs text-muted-foreground">
            <summary>El modelo no logró llamar bien a las tools</summary>
            <pre className="mt-1 break-words whitespace-pre-wrap">{malformed}</pre>
          </details>
        )}
        {last && !busy && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="mono-dim w-fit" tabIndex={0}>
                {last.usage.input + last.usage.output} tokens
                {last.finish === "limit" && " · Llegué al límite de pasos"}
                {last.finish === "aborted" && " · detenido"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {`${last.usage.input} entrada · ${last.usage.output} salida · ${last.steps} pasos · ${modelId} · sesión: ${tokens.input + tokens.output} tokens`}
            </TooltipContent>
          </Tooltip>
        )}
        <div ref={end} />
      </div>
      <div className="relative flex shrink-0 flex-col gap-2 border-t p-3">
        {mention.open && <MentionMenu mention={mention} />}
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
        {/* Desktop: una fila + selectores abajo. Mobile: dos filas (texto / acciones). */}
        <div className="flex flex-wrap items-end gap-2 md:flex-nowrap">
          <Textarea
            aria-label="Mensaje al Agente"
            rows={1}
            value={draft}
            placeholder="Preguntale al Agente, @ contexto"
            onChange={(e) => {
              setDraft(e.target.value)
              setCaret(e.target.selectionStart)
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            onKeyDown={(e) => {
              if (mention.onKeyDown(e)) return
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            className="order-1 max-h-40 min-h-11 w-full flex-1 resize-none md:order-2 md:min-h-9 md:w-auto"
          />
          <div className="order-2 md:order-1 [&_button]:max-md:size-11">
            <AttachMenu caps={caps} onPick={(p) => setPicked((l) => addPicked(l, p))} />
          </div>
          {isMobile && (
            <div className="order-3 flex min-w-0 flex-1 items-center gap-1 [&_button]:h-11">
              <ModelPicker settings={settings} active={{ provider, modelId }} />
              <ApprovalPicker />
            </div>
          )}
          {busy ? (
            <Button
              size="icon"
              aria-label="Detener"
              onClick={stop}
              className="order-4 max-md:size-11"
            >
              <Square />
            </Button>
          ) : (
            <Button
              size="icon"
              aria-label="Enviar"
              disabled={!draft.trim()}
              onClick={submit}
              className="order-4 max-md:size-11"
            >
              <Send />
            </Button>
          )}
        </div>
        {!isMobile && (
          <div className="flex flex-wrap items-center gap-1">
            <ModelPicker settings={settings} active={{ provider, modelId }} />
            <ApprovalPicker />
          </div>
        )}
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
