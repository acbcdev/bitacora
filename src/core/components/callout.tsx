import { Node, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"

// Callout (editor-blocks/03): nodo propio, no blockquote con attr (cita = texto de otro, callout =
// comentario propio). El tipo lo dice SOLO el emoji — sin color por tipo (ADR 0023).
const CALLOUT_KINDS = { note: "ℹ️", warning: "⚠️", tip: "💡" } as const
type CalloutKind = keyof typeof CALLOUT_KINDS
const ORDER = Object.keys(CALLOUT_KINDS) as CalloutKind[]

function CalloutView({ node, editor, updateAttributes }: NodeViewProps) {
  const kind = node.attrs.kind as CalloutKind
  return (
    <NodeViewWrapper className="callout">
      <button
        type="button"
        contentEditable={false}
        disabled={!editor.isEditable}
        aria-label="Cambiar tipo de callout"
        className="callout-emoji"
        // Rota nota → aviso → tip.
        onClick={() => updateAttributes({ kind: ORDER[(ORDER.indexOf(kind) + 1) % ORDER.length] })}
      >
        {CALLOUT_KINDS[kind]}
      </button>
      <NodeViewContent className="min-w-0 flex-1" />
    </NodeViewWrapper>
  )
}

export const Callout = Node.create({
  name: "callout",
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
          return kind in CALLOUT_KINDS ? kind : "note"
        },
        renderHTML: (attrs) => ({ "data-kind": attrs.kind }),
      },
    }
  },

  parseHTML: () => [{ tag: "div[data-callout]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", { "data-callout": "", ...HTMLAttributes }, 0],
  addNodeView: () => ReactNodeViewRenderer(CalloutView),
})
