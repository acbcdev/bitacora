import { Extension } from "@tiptap/react"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { Plugin, TextSelection } from "@tiptap/pm/state"

// Promoción por cruce (.scratch/block-selection/issues/02): con el botón apretado, si la
// selección de texto sale del bloque de origen se reemplaza por un NodeRangeSelection
// sin depth (la profundidad la da el ancestro común). Si el head vuelve al bloque del
// ancla, TextSelection anclada en el ancla ORIGINAL (el DOM pudo moverla al promover).
// Dentro de una tabla no se promueve: manda la selección de celdas. Halo, drag y bubble
// salen de la capa de bloques (block-controls), que adopta cualquier NodeRangeSelection.
export const CrossBlockSelect = Extension.create({
  name: "crossBlockSelect",
  addProseMirrorPlugins() {
    let down = false
    let anchor: number | null = null
    const release = () => {
      down = false
    }
    return [
      new Plugin({
        view: () => {
          document.addEventListener("mouseup", release)
          return { destroy: () => document.removeEventListener("mouseup", release) }
        },
        props: {
          handleDOMEvents: {
            mousedown: () => {
              down = true
              anchor = null
              return false
            },
            // Drag nativo de texto: el mouseup nunca llega.
            dragstart: () => {
              down = false
              return false
            },
          },
        },
        appendTransaction: (trs, _old, state) => {
          const sel = state.selection
          if (!down || !trs.some((t) => t.selectionSet) || !(sel instanceof TextSelection)) {
            return null
          }
          anchor ??= sel.anchor
          const { doc, tr } = state
          const $a = doc.resolve(anchor)
          if ($a.sameParent(sel.$head)) {
            if (sel.anchor === anchor) return null
            return tr.setSelection(TextSelection.create(doc, anchor, sel.head))
          }
          for (let d = $a.sharedDepth(sel.head); d > 0; d--) {
            if ($a.node(d).type.spec.tableRole) return null
          }
          return tr.setSelection(NodeRangeSelection.create(doc, anchor, sel.head))
        },
      }),
    ]
  },
})
