import { fireEvent, render, waitFor } from "@testing-library/react"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { Editor } from "@/core/components/editor"
import type { TiptapDoc } from "@/core/types/database"

// Promoción por cruce (.scratch/block-selection/issues/02): drag de texto que sale del
// bloque de origen → NodeRangeSelection de bloques enteros; volver al origen → texto.
// El drag nativo se simula como lo ve PM: mousedown + TextSelections leídas del DOM.

beforeAll(() => {
  document.elementFromPoint = () => null
})

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] })
const li = (text: string) => ({ type: "listItem", content: [p(text)] })
const cell = (text: string) => ({ type: "tableCell", content: [p(text)] })

async function setup(content: unknown[]) {
  const { container } = render(
    <Editor content={{ type: "doc", content } as TiptapDoc} onChange={() => {}} />,
  )
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  return (pm as HTMLElement & { editor: { view: EditorView } }).editor.view
}

// Posición dentro del texto `text` (offset chars desde su inicio).
const at = (view: EditorView, text: string, offset = 1) => {
  let found = -1
  view.state.doc.descendants((n, pos) => {
    if (found < 0 && n.isText && n.text === text) found = pos + offset
  })
  return found
}

const select = (view: EditorView, anchor: number, head: number) =>
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, anchor, head)))

const ABC = [p("Uno"), p("Dos"), p("Tres")]

test("drag de texto de A a C deja Selección de bloque A..C con halo", async () => {
  const view = await setup(ABC)
  fireEvent.mouseDown(view.dom)
  select(view, at(view, "Uno"), at(view, "Dos"))
  select(view, at(view, "Uno"), at(view, "Tres"))
  const sel = view.state.selection
  expect(sel).toBeInstanceOf(NodeRangeSelection)
  expect(sel.ranges.length).toBe(3)
  expect([sel.from, sel.to]).toEqual([0, view.state.doc.content.size])
  await waitFor(() =>
    expect(view.dom.querySelectorAll(".ProseMirror-selectednoderange").length).toBe(3),
  )
  fireEvent.mouseUp(document)
})

test("drag hacia arriba promueve igual", async () => {
  const view = await setup(ABC)
  fireEvent.mouseDown(view.dom)
  select(view, at(view, "Tres"), at(view, "Dos"))
  const sel = view.state.selection
  expect(sel).toBeInstanceOf(NodeRangeSelection)
  expect(sel.ranges.length).toBe(2)
  expect(sel.from).toBe(5)
  fireEvent.mouseUp(document)
})

test("volver al bloque ancla en el mismo drag restaura selección de texto", async () => {
  const view = await setup(ABC)
  const anchor = at(view, "Dos", 1)
  fireEvent.mouseDown(view.dom)
  select(view, anchor, at(view, "Tres"))
  expect(view.state.selection).toBeInstanceOf(NodeRangeSelection)
  // PM puede leer el DOM con el ancla movida al borde del bloque: manda el ancla original.
  select(view, 6, at(view, "Dos", 3))
  const sel = view.state.selection
  expect(sel).toBeInstanceOf(TextSelection)
  expect([sel.anchor, sel.head]).toEqual([anchor, at(view, "Dos", 3)])
  fireEvent.mouseUp(document)
})

test("cruce entre ítems de la misma lista selecciona solo esos ítems", async () => {
  const view = await setup([
    p("Antes"),
    { type: "bulletList", content: [li("a"), li("b"), li("c")] },
    p("Fin"),
  ])
  fireEvent.mouseDown(view.dom)
  select(view, at(view, "a", 0), at(view, "b"))
  const sel = view.state.selection
  expect(sel).toBeInstanceOf(NodeRangeSelection)
  expect(sel.ranges.map((r) => r.$from.nodeAfter!.type.name)).toEqual(["listItem", "listItem"])
  fireEvent.mouseUp(document)
})

test("cruce párrafo → ítem selecciona bloques top-level", async () => {
  const view = await setup([
    p("Antes"),
    { type: "bulletList", content: [li("a"), li("b")] },
    p("Fin"),
  ])
  fireEvent.mouseDown(view.dom)
  select(view, at(view, "Antes"), at(view, "b"))
  const sel = view.state.selection
  expect(sel.ranges.map((r) => r.$from.nodeAfter!.type.name)).toEqual(["paragraph", "bulletList"])
  fireEvent.mouseUp(document)
})

test("cruce dentro de una tabla no promueve", async () => {
  const view = await setup([
    {
      type: "table",
      content: [{ type: "tableRow", content: [cell("x"), cell("y")] }],
    },
  ])
  fireEvent.mouseDown(view.dom)
  select(view, at(view, "x", 0), at(view, "y"))
  expect(view.state.selection).not.toBeInstanceOf(NodeRangeSelection)
  fireEvent.mouseUp(document)
})

test("dos párrafos de la misma celda no promueven", async () => {
  const view = await setup([
    {
      type: "table",
      content: [{ type: "tableRow", content: [{ type: "tableCell", content: [p("x"), p("y")] }] }],
    },
  ])
  fireEvent.mouseDown(view.dom)
  select(view, at(view, "x", 0), at(view, "y"))
  expect(view.state.selection).not.toBeInstanceOf(NodeRangeSelection)
  fireEvent.mouseUp(document)
})

test("selección dentro de un solo bloque sigue siendo de texto", async () => {
  const view = await setup(ABC)
  fireEvent.mouseDown(view.dom)
  select(view, at(view, "Tres", 0), at(view, "Tres", 3))
  expect(view.state.selection).toBeInstanceOf(TextSelection)
  fireEvent.mouseUp(document)
})

test("sin botón apretado no promueve (Shift+flechas, API)", async () => {
  const view = await setup(ABC)
  select(view, at(view, "Uno"), at(view, "Tres"))
  expect(view.state.selection).toBeInstanceOf(TextSelection)
})
