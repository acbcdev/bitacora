import { useCallback, useEffect, useState } from "react"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import { Textarea } from "@/core/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs"
import { cn } from "@/core/lib/utils"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
import { DrawerContent, DrawerDescription, DrawerNested, DrawerTitle } from "@/core/ui/drawer"
import { ChevronRight } from "lucide-react"
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
  const fields = Object.keys(after).filter(
    (k) => k !== "id" && k !== "content" && (!before || before[k] !== after[k]),
  )
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
        <pre className="max-h-60 overflow-auto rounded-md border font-mono whitespace-pre-wrap">
          {(before
            ? diffLines(md(before.content), md(after.content))
            : diffLines("", md(after.content))
          )
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
      )}
    </div>
  )
}

const clean = (label: string) => label.replace(/ \(id [0-9a-f-]+\)$/, "")

type Editable = { op: Op; i: number }

function Editors({
  editable,
  edits,
  setEdits,
  pending,
}: {
  editable: Editable[]
  edits: Record<number, string>
  setEdits: React.Dispatch<React.SetStateAction<Record<number, string>>>
  pending: boolean
}) {
  return editable.map(({ op, i }) => (
    <label key={i} className="flex flex-col gap-1 text-xs">
      <span className="font-medium">{clean(op.label)}</span>
      <Textarea
        aria-label={`Cuerpo: ${op.label}`}
        disabled={!pending}
        className="max-h-60 font-mono"
        value={edits[i] ?? docToMarkdown((op.after as { content: TiptapDoc }).content)}
        onChange={(e) => setEdits((m) => ({ ...m, [i]: e.target.value }))}
      />
    </label>
  ))
}

// Mobile: la Propuesta es una card resumen con Aprobar/Descartar siempre a la vista; el detalle
// (Diff | Cambios) vive en un Drawer anidado a pantalla completa que abre tocar una operación.
function MobileDetail({
  proposal,
  open,
  onOpenChange,
  ...editors
}: {
  proposal: Proposal
  open: boolean
  onOpenChange(open: boolean): void
} & React.ComponentProps<typeof Editors>) {
  return (
    <DrawerNested open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-dvh data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-dvh data-[vaul-drawer-direction=bottom]:rounded-t-none">
        <DrawerTitle className="sr-only">Detalle de la Propuesta</DrawerTitle>
        <DrawerDescription className="sr-only">Diff y cambios de la Propuesta</DrawerDescription>
        <Tabs defaultValue="diff" className="min-h-0 flex-1 gap-0 px-4 pt-4">
          <TabsList className="w-full">
            <TabsTrigger value="diff">Diff</TabsTrigger>
            {editors.editable.length > 0 && <TabsTrigger value="cambios">Cambios</TabsTrigger>}
          </TabsList>
          <TabsContent value="diff" className="flex flex-col gap-3 overflow-y-auto py-3">
            {proposal.ops.map((op, i) => (
              <OpDiff key={i} op={op} />
            ))}
          </TabsContent>
          <TabsContent value="cambios" className="flex flex-col gap-3 overflow-y-auto py-3">
            <Editors {...editors} />
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </DrawerNested>
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
  const [tab, setTab] = useState("diff")
  const isMobile = useIsMobile()
  const [detail, setDetail] = useState(false)
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

  if (isMobile)
    return (
      <section aria-label="Propuesta" className="flex flex-col gap-2 rounded-xl border p-3">
        <ul className="flex flex-col text-sm">
          {proposal.ops.map((op, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setDetail(true)}
                className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 text-left"
              >
                <span className="min-w-0 break-words">{clean(op.label)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
        {pending ? (
          <div className="flex gap-2">
            <Button className="h-11 flex-1" onClick={approve}>
              Aprobar
            </Button>
            <Button className="h-11 flex-1" variant="outline" onClick={onDiscard}>
              Descartar
            </Button>
          </div>
        ) : (
          <span className="mono-dim">{status === "applied" ? "Aprobada" : "Descartada"}</span>
        )}
        <MobileDetail
          proposal={proposal}
          open={detail}
          onOpenChange={setDetail}
          editable={editable}
          edits={edits}
          setEdits={setEdits}
          pending={pending}
        />
      </section>
    )

  return (
    <section aria-label="Propuesta" className="flex flex-col gap-2 rounded-xl border p-3">
      <Tabs value={tab} onValueChange={setTab}>
        {editable.length > 0 && (
          <TabsList variant="line">
            <TabsTrigger value="diff">Diff</TabsTrigger>
            <TabsTrigger value="cambios">Cambios</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="diff" className="flex flex-col gap-3">
          {proposal.ops.map((op, i) => (
            <OpDiff key={i} op={op} />
          ))}
        </TabsContent>
        <TabsContent value="cambios" className="flex flex-col gap-3">
          <Editors editable={editable} edits={edits} setEdits={setEdits} pending={pending} />
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
