import { fireEvent, render, waitFor } from "@testing-library/react"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { Editor } from "@/core/components/editor"
import type { TiptapDoc } from "@/core/types/database"

// Teclado sobre Selección de bloque (.scratch/block-selection, ticket 05).

const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] })

async function setup() {
  const { container } = render(
    <Editor
      content={{ type: "doc", content: [para("Uno"), para("Dos"), para("Tres")] } as TiptapDoc}
    />,
  )
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  const view = (pm as HTMLElement & { editor: { view: EditorView } }).editor.view
  view.focus()
  // "Dos" + "Tres" (p 5..16).
  view.dispatch(view.state.tr.setSelection(NodeRangeSelection.create(view.state.doc, 5, 16)))
  return { pm, view }
}

const texts = (view: EditorView) => view.state.doc.children.map((n) => n.textContent)

test("Backspace borra los bloques seleccionados", async () => {
  const { pm, view } = await setup()
  fireEvent.keyDown(pm, { key: "Backspace" })
  expect(texts(view)).toEqual(["Uno"])
})

test("tipear una letra con Selección de bloque no modifica el doc", async () => {
  const { pm, view } = await setup()
  const before = view.state.doc
  // jsdom no inserta texto por keydown: el contrato observable es que el keydown se cancela
  // (sin default, el browser no dispara el input que reemplazaría los bloques).
  expect(fireEvent.keyDown(pm, { key: "x" })).toBe(false)
  expect(view.state.doc.eq(before)).toBe(true)
  // Atajos con Mod siguen pasando (Cmd+C, Cmd+A...).
  expect(fireEvent.keyDown(pm, { key: "c", metaKey: true })).toBe(true)
})

test("dead key / IME / emoji picker no reemplazan los bloques", async () => {
  const { pm, view } = await setup()
  const before = view.state.doc
  // Texto sin keydown de un carácter (emoji picker, text replacement): beforeinput cancelado.
  const input = new InputEvent("beforeinput", {
    inputType: "insertText",
    data: "á",
    cancelable: true,
  })
  expect(fireEvent(pm, input)).toBe(false)
  // Composición (´+a, Option+n, IME): no es cancelable → colapsa antes de que el browser
  // reemplace la selección del DOM.
  fireEvent.compositionStart(pm)
  expect(view.state.selection).toBeInstanceOf(TextSelection)
  expect(view.state.doc.eq(before)).toBe(true)
})

test("Esc en dos pasos: colapsa a texto con foco, después blur", async () => {
  const { pm, view } = await setup()
  fireEvent.keyDown(pm, { key: "Escape" })
  expect(view.state.selection).toBeInstanceOf(TextSelection)
  expect(view.hasFocus()).toBe(true)

  fireEvent.keyDown(pm, { key: "Escape" })
  expect(view.hasFocus()).toBe(false)
})

test("Cmd+C copia los bloques enteros", async () => {
  const { pm, view } = await setup()
  const data = new Map<string, string>()
  const clipboardData = {
    setData: (t: string, v: string) => data.set(t, v),
    getData: (t: string) => data.get(t) ?? "",
    clearData: () => data.clear(),
  }
  fireEvent.copy(pm, { clipboardData })
  expect(data.get("text/html")).toMatch(/<p[^>]*>Dos<\/p><p[^>]*>Tres<\/p>/)
  fireEvent.cut(pm, { clipboardData })
  expect(texts(view)).toEqual(["Uno"])
})

test("⌘D duplica la Selección de bloque debajo", async () => {
  const { pm, view } = await setup()
  fireEvent.keyDown(pm, { key: "d", ctrlKey: true })
  expect(texts(view)).toEqual(["Uno", "Dos", "Tres", "Dos", "Tres"])
})

test("⌘D con caret duplica el bloque que lo contiene", async () => {
  const { pm, view } = await setup()
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)))
  fireEvent.keyDown(pm, { key: "d", ctrlKey: true })
  expect(texts(view)).toEqual(["Uno", "Uno", "Dos", "Tres"])
})
