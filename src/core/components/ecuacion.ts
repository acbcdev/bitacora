import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorView } from "@tiptap/pm/view"

// Ecuación (editor-blocks/02): único punto de entrada del LaTeX (slash `/ecuacion` y clic para
// editar). Módulo propio: editor.tsx y slash-menu.tsx lo importan sin ciclo entre ellos.
// ponytail: prompt nativo, sin preview en vivo; popover propio si molesta al estudiar.
export function promptLatex(current?: string): string | null {
  return window.prompt("LaTeX", current)
}

// Clic edita el LaTeX. Vacío o cancelar = no-op.
export function editLatex(view: EditorView | undefined, node: PMNode, pos: number) {
  const latex = promptLatex(node.attrs.latex)
  if (!view || !latex || latex === node.attrs.latex) return
  view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex }))
}
