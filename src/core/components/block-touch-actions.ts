import { TextSelection } from "@tiptap/pm/state"
import type { Node, NodeType, ResolvedPos } from "@tiptap/pm/model"
import type { Editor } from "@tiptap/react"
import { isBlockPart } from "@/core/components/block-controls"
import type { BlockTarget } from "@/core/components/block-controls"

// Acciones de bloque para touch (block-touch.tsx). El target no viene del hover (block-controls)
// sino de la selección: el bloque MÁS PROFUNDO que contiene el cursor, con el mismo modelo que el
// gutter de desktop (isBlockPart): sub-bloque de un Desplegable, ítem de lista, etc.

// La tabla corta la bajada: en touch se mueve entera (sus celdas no son sub-bloques).
const opaque = (n: Node) => n.type.name === "table"

export function blockAround($pos: ResolvedPos): BlockTarget | null {
  let hit: BlockTarget | null = null
  for (let d = 1; d <= $pos.depth; d++) {
    const node = $pos.node(d)
    if (!isBlockPart(node, $pos.node(d - 1), $pos.index(d - 1) === 0))
      hit = { node, pos: $pos.before(d) }
    if (opaque(node)) break
  }
  return hit
}

export const currentBlock = (e: Editor) => blockAround(e.state.selection.$from)

// Todos los bloques del doc, padres antes que sus sub-bloques.
export function allBlocks(doc: Node): BlockTarget[] {
  const out: BlockTarget[] = []
  const walk = (parent: Node, start: number) =>
    parent.forEach((node, offset, i) => {
      const pos = start + offset
      if (!isBlockPart(node, parent, i === 0)) out.push({ node, pos })
      if (!opaque(node) && node.firstChild?.isBlock) walk(node, pos + 1)
    })
  walk(doc, 0)
  return out
}

// Pos donde el padre acepta el nodo. Si no lo acepta y estamos en su borde, prueba un nivel
// arriba: "antes del primer ítem" de una lista = "antes de la lista" para un párrafo.
function fit(doc: Node, pos: number, type: NodeType): number | null {
  for (;;) {
    const $p = doc.resolve(pos)
    if ($p.parent.canReplaceWith($p.index(), $p.index(), type)) return pos
    if (!$p.depth) return null
    if (pos === $p.start()) pos = $p.before()
    else if (pos === $p.end()) pos = $p.after()
    else return null
  }
}

// Huecos donde puede caer `b`: antes de cada bloque y después del último de cada contenedor.
// Nunca dentro de sí mismo. El drag elige el hueco más cercano al dedo.
// ponytail: sin wrapping — un ítem solo cae entre ítems (no crea lista nueva al soltarlo en el
// doc). Agregar findWrapping si se pide.
export type DropSlot = { pos: number; dom: HTMLElement; after: boolean }

export function dropSlots(e: Editor, b: BlockTarget): DropSlot[] {
  const { doc } = e.state
  const end = b.pos + b.node.nodeSize
  return allBlocks(doc).flatMap(({ node, pos }) => {
    const dom = e.view.nodeDOM(pos)
    if ((pos > b.pos && pos < end) || !(dom instanceof HTMLElement)) return []
    const $p = doc.resolve(pos)
    const edges = [{ at: pos, after: false }]
    if ($p.index() === $p.parent.childCount - 1)
      edges.push({ at: pos + node.nodeSize, after: true })
    return edges.flatMap(({ at, after }) => {
      const to = fit(doc, at, b.node.type)
      return to === null ? [] : [{ pos: to, dom, after }]
    })
  })
}

// Long-press: el cursor entra al bloque tocado para que las acciones operen sobre él.
export function selectBlockAt(e: Editor, x: number, y: number) {
  const hit = e.view.posAtCoords({ left: x, top: y })
  if (!hit) return false
  e.chain().setTextSelection(hit.pos).run()
  return !!currentBlock(e)
}

// Saca el bloque `b` y lo inserta en `to` (pos del doc ANTES de mover; dentro de `b` o pegado a
// él es no-op). Deja el cursor en el bloque movido.
export function moveBlock(e: Editor, b: BlockTarget, to: number) {
  const end = b.pos + b.node.nodeSize
  if (to >= b.pos && to <= end) return
  const tr = e.state.tr.delete(b.pos, end)
  const pos = tr.mapping.map(to)
  tr.insert(pos, b.node)
  e.view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1))))
  e.view.focus()
}

export function removeBlock(e: Editor) {
  const c = currentBlock(e)
  if (!c) return
  e.view.dispatch(e.state.tr.delete(c.pos, c.pos + c.node.nodeSize))
  e.view.focus()
}

// "+": párrafo vacío debajo con "/" tipeado → abre el slash menu real (el mismo de desktop).
export function insertBelow(e: Editor) {
  const c = currentBlock(e)
  if (!c) return
  const end = c.pos + c.node.nodeSize
  // Sin setTextSelection: insertContentAt ya deja el cursor dentro del párrafo nuevo. Calcularlo
  // a mano (end + 1) fallaba debajo de un ítem — ahí el párrafo parte la lista y queda un nivel
  // más afuera.
  e.chain().insertContentAt(end, { type: "paragraph" }).focus().insertContent("/").run()
}

export function blockPreview(e: Editor) {
  const t = currentBlock(e)?.node.textContent.trim()
  return t ? (t.length > 40 ? `${t.slice(0, 40)}…` : t) : "Bloque vacío"
}
