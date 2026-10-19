import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details"
import { InputRule, findParentNode } from "@tiptap/react"
import type { Editor } from "@tiptap/react"

// Desplegable (editor-blocks/01). Plegado/abierto es estado de vista (persist: false, default):
// el botón del node view solo alterna clases en el DOM, sin transacción → plegar no ensucia el
// doc ni dispara autosave, y toda nota abre con los desplegables cerrados.

// Alterna el Desplegable del cursor clickeando su botón (el mismo path que el mouse).
export function toggleDesplegable(editor: Editor): boolean {
  const found = findParentNode((n) => n.type.name === "details")(editor.state.selection)
  if (!found) return false
  const dom = editor.view.nodeDOM(found.pos) as HTMLElement | null
  dom?.querySelector<HTMLButtonElement>(":scope > button")?.click()
  // Cursor en el cuerpo que se acaba de plegar → al final del título, si no se tipea a ciegas.
  if (editor.state.selection.$from.parent.type.name !== "detailsSummary")
    editor.commands.setTextSelection(found.start + found.node.firstChild!.nodeSize - 1)
  return true
}

// Envuelve el bloque del cursor (queda como cuerpo) y lo abre: recién creado se escribe adentro.
export function setDesplegable(editor: Editor) {
  if (editor.commands.setDetails()) toggleDesplegable(editor)
}

const DesplegableDetails = Details.extend({
  // `> ` + espacio (estilo Notion): la extensión no trae input rule; la de blockquote se quitó.
  addInputRules() {
    const editor = this.editor
    return [
      new InputRule({
        find: /^>\s$/,
        handler: ({ range, chain }) => {
          if (!chain().deleteRange(range).setDetails().run()) return
          // El node view recién existe después del dispatch de la transacción de la regla.
          queueMicrotask(() => toggleDesplegable(editor))
        },
      }),
    ]
  },
  addKeyboardShortcuts() {
    // mod+enter ya es de NoteDialog/Review (expandir nota).
    return { ...this.parent?.(), "Mod-Shift-Enter": () => toggleDesplegable(this.editor) }
  },
})

export const Desplegable = [DesplegableDetails, DetailsSummary, DetailsContent]
