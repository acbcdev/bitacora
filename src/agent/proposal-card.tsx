import { useCallback, useEffect, useState } from "react"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import { Tabs, TabsList, TabsTrigger } from "@/core/ui/tabs"
import { cn } from "@/core/lib/utils"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
import { ChatMarkdown } from "@/agent/chat-markdown"
import { diffLines } from "@/core/agent/diff"
import type { Proposal } from "@/core/agent/proposal"
import type { Op } from "@/core/agent/tool"
import { docToMarkdown } from "@/core/lib/tiptap-markdown"
import type { TiptapDoc } from "@/core/types/database"

type Status = "pending" | "applied" | "discarded"

const show = (v: unknown) => (v === null || v === undefined ? "—" : String(v))
const clean = (label: string) => label.replace(/ \(id [0-9a-f-]+\)$/, "")

const hasContent = (op: Op) => op.entity === "notes" && "content" in op.after
// Solo editar tiene diff: crear no tiene un "antes" contra qué comparar.
const isEdit = (op: Op) => hasContent(op) && op.before !== null

function DiffView({ before, after }: { before: string; after: string }) {
  return (
    <pre className="rounded-md border font-mono text-xs whitespace-pre-wrap">
      {diffLines(before, after)
        .filter((l) => l.type !== "same" || l.text)
        .map((l, i) => (
          <span
            key={i}
            className={cn(
              "flex gap-2 px-2",
              l.type === "add" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
              l.type === "del" && "bg-destructive/15 text-destructive",
            )}
          >
            <span className="w-2 shrink-0 select-none">
              {l.type === "add" ? "+" : l.type === "del" ? "-" : ""}
            </span>
            <span className="min-h-[1lh] min-w-0 break-words">{l.text}</span>
          </span>
        ))}
    </pre>
  )
}

// Una Op, solo lectura. Notas: Markdown renderizado (o diff al editar, según la pestaña); el resto
// de las entidades: `campo: antes → después`.
function OpView({ op, view, tabs }: { op: Op; view: "diff" | "nota"; tabs?: React.ReactNode }) {
  const after = op.after as Record<string, unknown>
  const before = op.before as Record<string, unknown> | null
  const md = (d: unknown) => docToMarkdown(d as TiptapDoc)
  const edit = isEdit(op)
  const fields = Object.keys(after).filter(
    (k) => k !== "id" && k !== "content" && k !== "title" && (!before || before[k] !== after[k]),
  )
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="mono-dim">
            {op.entity === "notes" ? (edit ? "Nota editada" : "Nota nueva") : "Cambio"}
          </span>
          <h3 className="text-base leading-snug font-medium break-words">
            {typeof after.title === "string" && after.title ? after.title : clean(op.label)}
          </h3>
        </div>
        {tabs}
      </div>
      {fields.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {fields.map((k) => (
            <span key={k} className="mono-dim break-words">
              {k}: {before ? `${show(before[k])} → ` : ""}
              {show(after[k])}
            </span>
          ))}
        </div>
      )}
      {hasContent(op) && (
        <div className="max-h-[60dvh] overflow-y-auto">
          {edit && view === "diff" ? (
            <DiffView
              before={md((before as { content: unknown }).content)}
              after={md(after.content)}
            />
          ) : (
            <ChatMarkdown>{md(after.content)}</ChatMarkdown>
          )}
        </div>
      )}
    </div>
  )
}

// Propuesta de solo lectura: se lee y se aprueba o descarta acá, sin dialog ni drawer.
// Crear = Markdown; editar = pestañas Diff (por defecto) / Nota en la esquina del encabezado.
export function ProposalCard({
  proposal,
  status,
  onApprove,
  onDiscard,
}: {
  proposal: Proposal
  status: Status
  onApprove(proposal: Proposal): void
  onDiscard(): void
}) {
  const [view, setView] = useState<"diff" | "nota">("diff")
  const isMobile = useIsMobile()
  const pending = status === "pending"
  const approve = useCallback(() => onApprove(proposal), [proposal, onApprove])
  useEffect(() => {
    // Mobile no tiene teclado físico: sin atajo, solo el botón.
    if (!pending || isMobile) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        approve()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pending, isMobile, approve])
  const firstEdit = proposal.ops.findIndex(isEdit)
  return (
    <Tabs
      value={view}
      onValueChange={(v) => setView(v as "diff" | "nota")}
      aria-label="Propuesta"
      className="flex flex-col gap-4 rounded-xl bg-card p-4"
    >
      {proposal.ops.map((op, i) => (
        <OpView
          key={i}
          op={op}
          view={view}
          tabs={
            i === firstEdit && (
              <TabsList variant="line" className="-mt-1 -mr-2 shrink-0">
                <TabsTrigger value="diff">Diff</TabsTrigger>
                <TabsTrigger value="nota">Nota</TabsTrigger>
              </TabsList>
            )
          }
        />
      ))}
      {pending ? (
        <div className="flex gap-2">
          <Button size="sm" className="max-md:h-11 max-md:flex-1" onClick={approve}>
            Aprobar {!isMobile && <Kbd>⌘↵</Kbd>}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="max-md:h-11 max-md:flex-1"
            onClick={onDiscard}
          >
            Descartar
          </Button>
        </div>
      ) : (
        <span className="mono-dim">{status === "applied" ? "Aprobada" : "Descartada"}</span>
      )}
    </Tabs>
  )
}
