import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { EditorView } from "@tiptap/pm/view"
import { Editor } from "@/core/components/editor"
import type { TiptapDoc } from "@/core/types/database"

// Contrato de bloques (.scratch/editor-notion-ux/spec.md, historia 6 / issue 05, v2):
// - Handle + ⋮⋮ en el margen izquierdo del bloque hovered, todos los niveles.
// - + inserta párrafo vacío debajo y enfoca; sin menú propio.
// - ⋮⋮ click = SOLO menú (no toca la selección); Shift+click selecciona/extiende el
//   node-range (única fuente de selección de bloque).
// - Menú: Convertir a ▸ (Párrafo, H1-3, Lista, To-do, Cita, Código) · Duplicar · Eliminar.
// - Drag reordena; durante el drag aparece la línea guía de 2px.
// - El asa también aparece con el cursor en el gutter a la altura del bloque (mapeo por Y,
//   detección de zona propia — sin mousemove sintético).

beforeAll(() => {
  document.elementFromPoint = () => null
})

const para = (text: string) => ({
  type: "paragraph",
  content: text ? [{ type: "text", text }] : undefined,
})

async function setup(initial?: TiptapDoc) {
  const onChange = vi.fn()
  const { container } = render(
    <Editor
      content={
        initial ??
        ({
          type: "doc",
          content: [para("Uno"), para("Dos"), para("Tres")],
        } as TiptapDoc)
      }
      onChange={onChange}
    />,
  )
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  const view = (pm as HTMLElement & { editor: { view: EditorView } }).editor.view
  return { container, view, onChange }
}

type DocJSON = {
  content?: Array<{
    type: string
    attrs?: { level?: number }
    content?: Array<{ text?: string }>
  }>
}

// Último doc reportado por onChange (los disparos de menú/drag caen en ticks).
const lastDoc = (onChange: ReturnType<typeof vi.fn>): DocJSON => onChange.mock.lastCall?.[0]
const docTexts = (onChange: ReturnType<typeof vi.fn>) =>
  (lastDoc(onChange).content ?? []).map((n) => n.content?.[0]?.text ?? "")

// Las transacciones del editor caen en el siguiente tick: settle entre disparos.
const settle = () => new Promise((r) => setTimeout(r, 30))

// El wrapper del handle lo crea el plugin (div.block-drag-handle en tiptap-host): el
// "aparecer" es visibility. En jsdom hay que darle rects a los bloques para que el
// plugin pueda resolver el hover (clampToContent lee layout).
const handleRoot = () =>
  screen.getByTestId("block-handle").closest(".block-drag-handle") as HTMLElement
const hidden = () => expect(handleRoot().style.visibility).toBe("hidden")
const visible = () => expect(handleRoot().style.visibility).toBe("")

const posOf = (view: EditorView, text: string) => {
  const el = [...view.dom.querySelectorAll("p, h1, h2, h3")].find((p) => p.textContent === text)!
  return view.posAtDOM(el, 0)
}

async function hoverBlock(view: EditorView, text: string) {
  const pos = posOf(view, text)
  vi.spyOn(view, "posAtCoords").mockReturnValue({ pos: pos + 1, inside: -1 })
  for (const el of view.dom.querySelectorAll("p, h1, h2, h3")) {
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 24,
      left: 0,
      right: 100,
      width: 100,
      height: 24,
    } as DOMRect)
  }
  fireEvent.mouseMove(view.dom, { clientX: 100, clientY: 100 })
  // El plugin resuelve el hover en un rAF: esperar el tick para que onNodeChange corra
  // (visible() puede ser ya true del hover anterior).
  await new Promise((r) => setTimeout(r, 60))
  await waitFor(visible)
}

const dataTransfer = () =>
  ({
    clearData: vi.fn(),
    setDragImage: vi.fn(),
    setData: vi.fn(),
    getData: () => "",
  }) as unknown as DataTransfer

test("hover muestra + y ⋮⋮; al salir del editor se esconden", async () => {
  const { view } = await setup()
  hidden()
  await hoverBlock(view, "Dos")
  visible()
  fireEvent.mouseLeave(view.dom)
  await waitFor(hidden)
})

test("+ inserta un párrafo vacío debajo del bloque y enfoca", async () => {
  const { view, onChange } = await setup()
  await hoverBlock(view, "Dos")
  fireEvent.click(screen.getByTestId("block-add"))
  await waitFor(() => expect(docTexts(onChange)).toEqual(["Uno", "Dos", "", "Tres"]))
  // El cursor quedó dentro del párrafo nuevo.
  expect(view.state.selection.empty).toBe(true)
  expect(view.state.doc.resolve(view.state.selection.from).parent.type.name).toBe("paragraph")
  expect(view.state.doc.resolve(view.state.selection.from).parent.textContent).toBe("")
})

describe("menú del ⋮⋮", () => {
  // mousedown selecciona el bloque (node-range); Enter abre el menú (Radix keydown).
  const openMenu = async (view: EditorView, text: string) => {
    await hoverBlock(view, text)
    fireEvent.mouseDown(screen.getByTestId("block-handle"))
    fireEvent.keyDown(screen.getByTestId("block-handle"), { key: "Enter" })
    return screen.findByRole("menu")
  }

  test("Convertir a ▸: Heading 1 transforma el bloque entero", async () => {
    const { view, onChange } = await setup()
    await openMenu(view, "Dos")

    fireEvent.click(await screen.findByRole("menuitem", { name: /Convertir a/ }))
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Heading 1/ }))
    await settle()
    await waitFor(() =>
      expect(lastDoc(onChange).content?.map((n) => n.type)).toEqual([
        "paragraph",
        "heading",
        "paragraph",
      ]),
    )
    expect(lastDoc(onChange).content?.[1]?.attrs?.level).toBe(1)
  })

  test("Convertir a ▸: To-do transforma el bloque entero", async () => {
    const { view, onChange } = await setup()
    await openMenu(view, "Tres")

    fireEvent.click(await screen.findByRole("menuitem", { name: /Convertir a/ }))
    fireEvent.click(await screen.findByRole("menuitem", { name: /To-do/ }))
    await settle()
    await waitFor(() => expect(lastDoc(onChange).content?.[2]?.type).toBe("taskList"))
  })

  test("Duplicar copia el bloque debajo (build propio)", async () => {
    const { view, onChange } = await setup()
    await openMenu(view, "Dos")
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicar" }))
    await settle()
    await waitFor(() => expect(docTexts(onChange)).toEqual(["Uno", "Dos", "Dos", "Tres"]))
  })

  test("Eliminar borra el bloque sin confirmación", async () => {
    const { view, onChange } = await setup()
    await openMenu(view, "Dos")
    fireEvent.click(await screen.findByRole("menuitem", { name: "Eliminar" }))
    await settle()
    await waitFor(() => expect(docTexts(onChange)).toEqual(["Uno", "Tres"]))
  })
})

describe("drag", () => {
  test("reordenar dos párrafos (drag básico del AC)", async () => {
    const { view, onChange } = await setup()
    await hoverBlock(view, "Uno")

    fireEvent.dragStart(screen.getByTestId("block-handle"), { dataTransfer: dataTransfer() })
    await settle()

    // El drop cae al final del doc (después de "Tres").
    vi.spyOn(view, "posAtCoords").mockReturnValue({ pos: view.state.doc.content.size, inside: -1 })
    fireEvent.dragOver(view.dom, { clientX: 100, clientY: 300 })
    fireEvent.drop(view.dom, { clientX: 100, clientY: 300, dataTransfer: dataTransfer() })
    await settle()

    await waitFor(() => expect(docTexts(onChange)).toEqual(["Dos", "Tres", "Uno"]))
  })

  test("durante el drag aparece la línea guía de 2px y al soltar desaparece", async () => {
    const { view } = await setup()
    await hoverBlock(view, "Uno")
    vi.spyOn(view, "posAtCoords").mockReturnValue({ pos: posOf(view, "Tres"), inside: -1 })

    fireEvent.dragStart(screen.getByTestId("block-handle"), { dataTransfer: dataTransfer() })
    fireEvent.dragOver(view.dom, { clientX: 100, clientY: 300 })

    const line = await screen.findByTestId("drop-line")
    expect(line.style.height).toBe("2px")

    fireEvent.dragEnd(screen.getByTestId("block-handle"))
    await waitFor(() => expect(screen.queryByTestId("drop-line")).toBeNull())
  })
})

describe("node-range", () => {
  test("click en ⋮⋮ NO toca la selección (solo menú); Shift+click selecciona y extiende", async () => {
    const { view } = await setup()
    await hoverBlock(view, "Dos")

    // Click simple: la selección del editor queda intacta (contrato v2).
    fireEvent.mouseDown(screen.getByTestId("block-handle"))
    expect(view.state.selection.empty).toBe(true)

    // Shift+mousedown en ⋮⋮ de "Dos" (p 5..10): node-range desde el caret (0) → 2 rangos.
    fireEvent.mouseDown(screen.getByTestId("block-handle"), { shiftKey: true })
    const sel = view.state.selection as unknown as { ranges: unknown[] }
    expect(sel.ranges.length).toBe(2)
    expect(view.state.selection.from).toBe(0)
    expect(view.state.selection.to).toBe(10)

    // Shift+mousedown en ⋮⋮ de "Tres" (p 10..15): extiende el rango hasta cubrirlo.
    await hoverBlock(view, "Tres")
    fireEvent.mouseDown(screen.getByTestId("block-handle"), { shiftKey: true })
    const extended = view.state.selection as unknown as { ranges: unknown[] }
    expect(extended.ranges.length).toBe(3)
    expect(view.state.selection.from).toBe(0)
  })
})

describe("visibilidad del asa (v2: bloque + gutter)", () => {
  // Rects diferenciados por bloque para que el mapeo por Y pueda distinguirlos.
  const stackRects = (view: EditorView) => {
    const blocks = [...view.dom.querySelectorAll("p, h1, h2, h3")]
    blocks.forEach((el, i) => {
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
        top: i * 24,
        bottom: (i + 1) * 24,
        left: 0,
        right: 100,
        width: 100,
        height: 24,
      } as DOMRect)
    })
  }
  const hostEl = (container: HTMLElement) => container.firstElementChild as HTMLElement

  test("el asa aparece con el cursor en el gutter a la altura del bloque (mapeo por Y)", async () => {
    const { view, container, onChange } = await setup()
    hidden()
    stackRects(view)
    const h = hostEl(container)
    expect(view.state.doc.child(1).textContent).toBe("Dos")

    // El gutter: mousemove sobre el host que no cae en el contenteditable.
    fireEvent.mouseMove(h, { clientX: -40, clientY: 36 }) // mitad del bloque "Dos"
    await waitFor(visible)

    // El target del mapeo es "Dos": el menú del asa (abierta desde el gutter) opera sobre él.
    fireEvent.keyDown(screen.getByTestId("block-handle"), { key: "Enter" })
    fireEvent.click(await screen.findByRole("menuitem", { name: /Convertir a/ }))
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Heading 1/ }))
    await settle()
    await waitFor(() => expect(lastDoc(onChange).content?.[1]?.type).toBe("heading"))
  })
})
