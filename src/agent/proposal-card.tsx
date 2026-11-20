import { useEffect, useState } from "react"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs"
import { cn } from "@/core/lib/utils"
import { diffLines } from "@/core/agent/diff"
import type { Proposal } from "@/core/agent/proposal"
import type { Op } from "@/core/agent/tool"
import { docToMarkdown } from "@/core/lib/tiptap-markdown"
import type { TiptapDoc } from "@/core/types/database"

type Status = "pending" | "applied" | "discarded"

const show = (v: unknown) => (v === null || v === undefined ? "—" : String(v))

// Solo lectura. Notas: diff por línea del Markdown; el resto `antes → después`; altas solo "después".
function OpDiff({ op }: { op: Op }) {
  const before = op.before as Record<string, unknown> | null
  const after = op.after as Record<string, unknown>
  const fields = Object.keys(after).filter((k) => k !== "id" && k !== "content")
  const hasContent = op.entity === "notes" && "content" in after
  const md = (d: unknown) => docToMarkdown(d as TiptapDoc)

  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="font-medium">{op.label}</span>
      {fields.map((k) => (
        <span key={k} className="mono-dim break-words">
          {k}: {before ? `${show(before[k])} → ` : ""}
          {show(after[k])}
        </span>
      ))}
      {hasContent && (
        <pre className="max-h-60 overflow-auto rounded-md bg-muted p-2 font-mono whitespace-pre-wrap">
          {(before
            ? diffLines(md(before.content), md(after.content))
            : diffLines("", md(after.content))
          ).map((l, i) => (
            <span
              key={i}
              className={cn(
                "block",
                l.type === "add" && "bg-green-500/15",
                l.type === "del" && "bg-red-500/15 line-through",
              )}
            >
              {l.type === "add" ? "+ " : l.type === "del" ? "- " : "  "}
              {l.text}
            </span>
          ))}
        </pre>
      )}
    </div>
  )
}

export function ProposalCard({
  proposal,
  status,
  onApprove,
  onDiscard,
}: {
  proposal: Proposal
  status: Status
  onApprove(): void
  onDiscard(): void
}) {
  const [tab, setTab] = useState("resumen")
  const pending = status === "pending"
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onApprove()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pending, onApprove])

  return (
    <section aria-label="Propuesta" className="flex flex-col gap-2 rounded-xl border p-3">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="resumen">Propuesta</TabsTrigger>
          <TabsTrigger value="diff">Diff</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen">
          <ul className="flex flex-col gap-1 text-sm">
            {proposal.ops.map((op, i) => (
              <li key={i}>{op.label.replace(/ \(id [0-9a-f-]+\)$/, "")}</li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="diff" className="flex flex-col gap-3">
          {proposal.ops.map((op, i) => (
            <OpDiff key={i} op={op} />
          ))}
        </TabsContent>
      </Tabs>
      {pending ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={onApprove}>
            Aprobar <Kbd>⌘↵</Kbd>
          </Button>
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            Descartar
          </Button>
        </div>
      ) : (
        <span className="mono-dim">{status === "applied" ? "Aprobada" : "Descartada"}</span>
      )}
    </section>
  )
}
