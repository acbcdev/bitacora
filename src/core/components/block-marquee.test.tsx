import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import type { EditorView } from "@tiptap/pm/view"
import { Editor } from "@/core/components/editor"
import type { TiptapDoc } from "@/core/types/database"

// Marquee (.scratch/block-selection/issues/03): mousedown en zona sin texto + drag →
// NodeRangeSelection de los bloques top-level que toca el rectángulo.

beforeAll(() => {
  document.elementFromPoint = () => null
})

const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] })

// Uno p 0..5 · Dos p 5..10 · Tres p 10..16, apilados de a 24px desde y=0.
async function setup() {
  const { container } = render(
    <div style={{ overflowY: "auto" }}>
      <Editor
        content={{ type: "doc", content: [para("Uno"), para("Dos"), para("Tres")] } as TiptapDoc}
        onChange={() => {}}
      />
    </div>,
  )
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  const view = (pm as HTMLElement & { editor: { view: EditorView } }).editor.view
  view.state.doc.forEach((_, offset, i) => {
    vi.spyOn(view.nodeDOM(offset) as HTMLElement, "getBoundingClientRect").mockReturnValue({
      top: i * 24,
      bottom: (i + 1) * 24,
      left: 0,
      right: 100,
      width: 100,
      height: 24,
    } as DOMRect)
  })
  const scroller = container.firstElementChild as HTMLElement
  return { view, host: scroller.firstElementChild as HTMLElement, scroller }
}

const range = (view: EditorView) => {
  const s = view.state.selection
  return s instanceof NodeRangeSelection ? [s.from, s.to] : null
}

test("marquee desde el margen selecciona los bloques intersectados y achicar reduce", async () => {
  const { view, host } = await setup()
  fireEvent.mouseDown(host, { clientX: -40, clientY: 30 })
  fireEvent.mouseMove(host, { clientX: 50, clientY: 60 })
  expect(range(view)).toEqual([5, 16])
  expect(screen.getByTestId("block-marquee")).toBeTruthy()
  await waitFor(() =>
    expect(view.dom.querySelectorAll("p.ProseMirror-selectednoderange").length).toBe(2),
  )

  fireEvent.mouseMove(host, { clientX: 50, clientY: 40 })
  expect(range(view)).toEqual([5, 10])

  fireEvent.mouseUp(host, { clientX: 50, clientY: 40 })
  expect(screen.queryByTestId("block-marquee")).toBeNull()
  expect(range(view)).toEqual([5, 10])
})

test("movimiento bajo el umbral no crea selección", async () => {
  const { view, host } = await setup()
  fireEvent.mouseDown(host, { clientX: -40, clientY: 30 })
  fireEvent.mouseMove(host, { clientX: -38, clientY: 32 })
  fireEvent.mouseUp(host, { clientX: -38, clientY: 32 })
  expect(range(view)).toBeNull()
  expect(screen.queryByTestId("block-marquee")).toBeNull()
})

test("mousedown sobre texto no arranca marquee", async () => {
  const { view, host } = await setup()
  fireEvent.mouseDown(view.nodeDOM(0) as HTMLElement, { clientX: 10, clientY: 10 })
  fireEvent.mouseMove(host, { clientX: 50, clientY: 60 })
  expect(range(view)).toBeNull()
  expect(screen.queryByTestId("block-marquee")).toBeNull()
})

test("mousedown en el gutter del asa no arranca marquee", async () => {
  const { view, host } = await setup()
  fireEvent.mouseDown(host.querySelector(".block-drag-handle")!, { clientX: -40, clientY: 30 })
  fireEvent.mouseMove(host, { clientX: 50, clientY: 60 })
  expect(range(view)).toBeNull()
})

test("marquee nuevo reemplaza la selección previa (Shift no suma)", async () => {
  const { view, host } = await setup()
  view.dispatch(view.state.tr.setSelection(NodeRangeSelection.create(view.state.doc, 0, 5, 0)))
  fireEvent.mouseDown(host, { clientX: -40, clientY: 50, shiftKey: true })
  fireEvent.mouseMove(host, { clientX: 50, clientY: 60, shiftKey: true })
  fireEvent.mouseUp(host)
  expect(range(view)).toEqual([10, 16])
})

test("el punto de inicio sigue al contenido cuando la nota scrollea", async () => {
  const { view, host, scroller } = await setup()
  fireEvent.mouseDown(host, { clientX: -40, clientY: 50 }) // sobre Tres
  scroller.scrollTop = 24 // el inicio queda en y=26 (Dos)
  fireEvent.mouseMove(host, { clientX: 50, clientY: 10 })
  expect(range(view)).toEqual([0, 10])
  fireEvent.mouseUp(host)
})

test("cerca del borde arranca el loop de auto-scroll y mouseup lo cancela", async () => {
  const { host, scroller } = await setup()
  vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 100 } as DOMRect)
  const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(7)
  const cancel = vi.spyOn(window, "cancelAnimationFrame")
  fireEvent.mouseDown(host, { clientX: -40, clientY: 30 })
  fireEvent.mouseMove(host, { clientX: 50, clientY: 90 })
  expect(raf).toHaveBeenCalled()
  fireEvent.mouseUp(host)
  expect(cancel).toHaveBeenCalledWith(7)
})
