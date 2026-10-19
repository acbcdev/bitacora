import { Node, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { InfoIcon, LightbulbIcon, TriangleAlertIcon } from "lucide-react"
import { CALLOUT_KINDS, NODE, type CalloutKind } from "@/core/lib/tiptap-markdown"

// Callout (editor-blocks/03): nodo propio, no blockquote con attr (cita = texto de otro, callout =
// comentario propio). El tipo lo dice SOLO el ícono lucide — sin color por tipo (ADR 0023), nunca
// emoji (docs/design-system.md). Record sobre CalloutKind: un tipo nuevo sin ícono no compila.
export const CALLOUT_META: Record<
  CalloutKind,
  { icon: typeof InfoIcon; label: string; keywords: string }
> = {
  note: { icon: InfoIcon, label: "nota", keywords: "note info" },
  warning: { icon: TriangleAlertIcon, label: "aviso", keywords: "warning alerta" },
  tip: { icon: LightbulbIcon, label: "tip", keywords: "consejo idea" },
}

function CalloutView({ node, editor, updateAttributes }: NodeViewProps) {
  const kind = node.attrs.kind as CalloutKind
  const Icon = CALLOUT_META[kind].icon
  return (
    <NodeViewWrapper className="callout">
      <button
        type="button"
        contentEditable={false}
        disabled={!editor.isEditable}
        aria-label="Cambiar tipo de callout"
        className="callout-icon"
        // Rota nota → aviso → tip → nota.
        onClick={() =>
          updateAttributes({
            kind: CALLOUT_KINDS[(CALLOUT_KINDS.indexOf(kind) + 1) % CALLOUT_KINDS.length],
          })
        }
      >
        <Icon className="size-4" />
      </button>
      <NodeViewContent className="min-w-0 flex-1" />
    </NodeViewWrapper>
  )
}

export const Callout = Node.create({
  name: NODE.callout,
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: "note",
        // HTML pegado de afuera: kind desconocido → nota (si no, botón vacío y export roto).
        parseHTML: (el) => {
          const kind = el.getAttribute("data-kind") ?? ""
          return (CALLOUT_KINDS as readonly string[]).includes(kind) ? kind : "note"
        },
        renderHTML: (attrs) => ({ "data-kind": attrs.kind }),
      },
    }
  },

  parseHTML: () => [{ tag: "div[data-callout]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", { "data-callout": "", ...HTMLAttributes }, 0],
  addNodeView: () => ReactNodeViewRenderer(CalloutView),
})
