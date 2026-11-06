import type { EditorView } from "@tiptap/pm/view"
import { docToNotionMarkdown } from "@/core/lib/tiptap-markdown"
import type { TiptapDoc } from "@/core/types/database"
import { CornerDownLeftIcon } from "lucide-react"
import { useState } from "react"
import { createRoot } from "react-dom/client"
import { Button } from "@/core/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/core/ui/popover"
import { Textarea } from "@/core/ui/textarea"

// Ecuación (editor-blocks/02): único punto de entrada del LaTeX (slash `/ecuacion`, bloque →
// Ecuación y clic para editar). Popover anclado bajo el nodo; la ecuación del doc ES el preview:
// cada tecla actualiza el nodo sin historial, y al cerrar queda un solo paso de undo.
// Montaje imperativo (createRoot): los call sites solo llaman editLatex(view, pos), sin estado.
const isMathNode = (name = "") => /^(inline|block)Math$/.test(name)
const isMath = (view: EditorView, pos: number) => isMathNode(view.state.doc.nodeAt(pos)?.type.name)

function setLatex(view: EditorView, pos: number, latex: string, history: boolean) {
  const node = view.state.doc.nodeAt(pos)!
  const tr = view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex })
  view.dispatch(history ? tr : tr.setMeta("addToHistory", false))
}

function LatexPopover(props: {
  anchor: () => DOMRect
  initial: string
  onInput: (v: string) => void
  onClose: (v: string | null) => void
}) {
  const [latex, setValue] = useState(props.initial)
  return (
    // Clic afuera = Listo (como Notion); Esc = cancelar (lo maneja onEscapeKeyDown).
    <Popover defaultOpen onOpenChange={(open) => !open && props.onClose(latex)}>
      <PopoverAnchor virtualRef={{ current: { getBoundingClientRect: props.anchor } }} />
      <PopoverContent
        // "always": el ancla se reposiciona cada frame — la ecuación cambia de tamaño al tipear.
        updatePositionStrategy="always"
        align="start"
        // -16 = p-1.5 + px-2.5 del textarea: el texto queda justo bajo la ecuación.
        alignOffset={-16}
        sideOffset={4}
        className="w-[min(32rem,calc(100vw-2rem))] flex-row items-center gap-2 p-1.5"
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          props.onClose(null)
        }}
      >
        <Textarea
          autoFocus
          // Cursor al final: editar es casi siempre agregar/corregir la cola.
          onFocus={(e) => e.currentTarget.setSelectionRange(9999, 9999)}
          aria-label="LaTeX"
          value={latex}
          onChange={(e) => {
            setValue(e.target.value)
            props.onInput(e.target.value)
          }}
          onKeyDown={(e) => {
            // Enter = Listo; Shift+Enter salta de línea (LaTeX multilínea).
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              props.onClose(latex)
            }
          }}
          placeholder="\frac{a}{b}"
          spellCheck={false}
          rows={1}
          className="min-h-0 resize-none border-0 py-1 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Button size="sm" onClick={() => props.onClose(latex)}>
          Listo <CornerDownLeftIcon />
        </Button>
      </PopoverContent>
    </Popover>
  )
}

// Ecuación nueva: se inserta con latex "" (placeholder por CSS) y se abre el editor encima.
// ponytail: busca el math vacío en vez de mapear la posición del insert; vacíos no persisten
// (cerrar vacío los borra), así que hay a lo sumo uno.
export function editEmptyMath(view: EditorView) {
  let pos = -1
  view.state.doc.descendants((n, p) => {
    if (pos < 0 && isMathNode(n.type.name) && !n.attrs.latex) pos = p
    return pos < 0
  })
  if (pos >= 0) editLatex(view, pos)
}

// Abre el editor sobre el nodo math en `pos`. Vacío al cerrar = se borra el nodo.
export function editLatex(view: EditorView | undefined, pos: number) {
  if (!view || !isMath(view, pos)) return
  // El node view de tiptap no tiene `update`: cada cambio de attrs recrea el DOM. El ancla se
  // busca de nuevo en cada medición; el último rect sirve si el nodo desapareció.
  let rect = new DOMRect()
  const anchor = () => {
    const el = isMath(view, pos) ? view.nodeDOM(pos) : null
    if (el instanceof HTMLElement) rect = el.getBoundingClientRect()
    return rect
  }
  const original = view.state.doc.nodeAt(pos)!.attrs.latex as string
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  let closed = false
  const close = (value: string | null) => {
    if (closed) return
    closed = true
    // Microtask: no desmontar el root en medio del handler de React que cerró.
    queueMicrotask(() => {
      root.unmount()
      host.remove()
    })
    // El doc pudo cambiar con el popover abierto (sync remoto): solo si el nodo sigue ahí.
    if (!isMath(view, pos)) return
    // Volver al original sin historial y aplicar el final con historial = un solo undo.
    if (view.state.doc.nodeAt(pos)!.attrs.latex !== original) setLatex(view, pos, original, false)
    const latex = value === null ? original : value.trim()
    if (!latex) view.dispatch(view.state.tr.delete(pos, pos + 1))
    else if (latex !== original) setLatex(view, pos, latex, true)
    view.focus()
  }
  root.render(
    <LatexPopover
      anchor={anchor}
      initial={original}
      onInput={(v) => isMath(view, pos) && setLatex(view, pos, v, false)}
      onClose={close}
    />,
  )
}

// Copiar con ecuaciones: Notion ignora `$$x$$` si el clipboard trae text/html (verificado a mano),
// así que con math en la selección solo va text/plain (formato docToNotionMarkdown). El HTML de
// ProseMirror viaja en un MIME propio que Chrome conserva y Notion no lee: pegar adentro de
// Bitácora lo recupera (pasteBitacora) sin perder formato. Sin math = copy normal de ProseMirror.
export const BITACORA_MIME = "application/x-bitacora-html"

export function copyWithMath(view: EditorView, event: ClipboardEvent, cut: boolean) {
  const slice = view.state.selection.content()
  let hasMath = false
  slice.content.descendants((n) => {
    hasMath ||= isMathNode(n.type.name)
    return !hasMath
  })
  if (!hasMath || !event.clipboardData) return false
  const json = slice.content.toJSON() as TiptapDoc["content"]
  // Selección dentro de un párrafo: el slice son nodos inline sueltos, docToMarkdown espera bloques.
  const blocks = slice.content.firstChild?.isInline ? [{ type: "paragraph", content: json }] : json
  event.preventDefault()
  event.clipboardData.clearData()
  event.clipboardData.setData(
    "text/plain",
    docToNotionMarkdown({ type: "doc", content: blocks } as TiptapDoc),
  )
  event.clipboardData.setData(BITACORA_MIME, view.serializeForClipboard(slice).dom.innerHTML)
  if (cut) view.dispatch(view.state.tr.deleteSelection().scrollIntoView())
  return true
}

// pasteHTML vuelve a llamar handlePaste con el mismo event: el flag corta la recursión.
let pasting = false
export function pasteBitacora(view: EditorView, event: ClipboardEvent) {
  const html = event.clipboardData?.getData(BITACORA_MIME)
  if (pasting || !html) return false
  pasting = true
  try {
    return view.pasteHTML(html, event)
  } finally {
    pasting = false
  }
}
