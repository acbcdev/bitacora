import { Extension } from "@tiptap/react"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { Plugin, TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"

// Selección de bloque → selección de texto en el inicio del rango. false si no había.
export function collapseBlockSelection(view: EditorView) {
  const sel = view.state.selection
  if (!(sel instanceof NodeRangeSelection)) return false
  view.dispatch(view.state.tr.setSelection(TextSelection.near(sel.$from)))
  return true
}

const isBlockSel = (view: EditorView) => view.state.selection instanceof NodeRangeSelection

// Texto sobre Selección de bloque (.scratch/block-selection, ticket 05): no reemplaza los
// bloques. El Esc en dos pasos vive en el handler global de editor.tsx (orden de prioridad).
export const BlockSelectionKeys = Extension.create({
  name: "blockSelectionKeys",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown: (view, event) =>
            isBlockSel(view) && event.key.length === 1 && !event.metaKey && !event.ctrlKey,
          handleDOMEvents: {
            // Texto sin keydown de un carácter (emoji picker, text replacement).
            beforeinput: (view, event) => {
              if (!isBlockSel(view) || !/^insert(Text|ReplacementText)$/.test(event.inputType))
                return false
              event.preventDefault()
              return true
            },
            // Composición (dead keys, Option+n, IME) no es cancelable: colapsar antes de que
            // el browser reemplace la selección del DOM.
            compositionstart: (view) => {
              collapseBlockSelection(view)
              return false
            },
          },
        },
      }),
    ]
  },
})
