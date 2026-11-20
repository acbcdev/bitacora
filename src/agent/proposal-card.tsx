import { useCallback, useEffect, useState } from "react"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import { Textarea } from "@/core/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs"
import { cn } from "@/core/lib/utils"
import { diffLines } from "@/core/agent/diff"
import type { Proposal } from "@/core/agent/proposal"
import type { Op } from "@/core/agent/tool"
import { docToMarkdown, markdownToDoc } from "@/core/lib/tiptap-markdown"
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
  onApprove(edited: Proposal): void
  onDiscard(): void
}) {
  const [tab, setTab] = useState("resumen")
  // Ediciones del usuario al Markdown del "después" de las notas, por índice de Op.
  const [edits, setEdits] = useState<Record<number, string>>({})
  const pending = status === "pending"
  const editable = proposal.ops.flatMap((op, i) =>
    op.entity === "notes" && "content" in op.after ? [{ op, i }] : [],
  )
  const approve = useCallback(() => {
    // Solo se reemplaza el cuerpo si el texto cambió: evita un round-trip Markdown innecesario.
    const ops = proposal.ops.map((op, i) =>
      i in edits ? { ...op, after: { ...op.after, content: markdownToDoc(edits[i]) } } : op,
    )
    onApprove({ ops })
  }, [proposal, edits, onApprove])
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        approve()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pending, approve])

  return (
    <section aria-label="Propuesta" className="flex flex-col gap-2 rounded-xl border p-3">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="resumen">Propuesta</TabsTrigger>
          <TabsTrigger value="diff">Diff</TabsTrigger>
          {editable.length > 0 && <TabsTrigger value="cambios">Cambios</TabsTrigger>}
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
        <TabsContent value="cambios" className="flex flex-col gap-3">
          {editable.map(({ op, i }) => (
            <label key={i} className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{op.label.replace(/ \(id [0-9a-f-]+\)$/, "")}</span>
              <Textarea
                aria-label={`Cuerpo: ${op.label}`}
                disabled={!pending}
                className="max-h-60 font-mono"
                value={edits[i] ?? docToMarkdown((op.after as { content: TiptapDoc }).content)}
                onChange={(e) => setEdits((m) => ({ ...m, [i]: e.target.value }))}
              />
            </label>
          ))}
        </TabsContent>
      </Tabs>
      {pending ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={approve}>
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
