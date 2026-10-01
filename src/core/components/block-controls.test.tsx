import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { TextSelection } from "@tiptap/pm/state"
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

describe("zona muerta del asa", () => {
  test("mousedown en la zona muerta del wrapper no roba el foco (preventDefault); el grip queda vivo para el drag", async () => {
    await setup()
    const wrapper = handleRoot()
    const dead = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    wrapper.dispatchEvent(dead)
    expect(dead.defaultPrevented).toBe(true)
    // El grip NO pasa por el preventDefault: el drag nativo es acción default del mousedown.
    const grip = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    screen.getByTestId("block-handle").dispatchEvent(grip)
    expect(grip.defaultPrevented).toBe(false)
  })
})

describe("node-range", () => {
  test("click en ⋮⋮ selecciona el bloque (contrato v3) y abre el menú; Shift+click extiende", async () => {
    const { view } = await setup()
    await hoverBlock(view, "Dos")

    // Mod+click: selecciona el bloque SIN abrir el menú.
    fireEvent.mouseDown(screen.getByTestId("block-handle"))
    fireEvent.click(screen.getByTestId("block-handle"), { metaKey: true })
    const mod = view.state.selection as unknown as { ranges: unknown[] }
    expect(mod.ranges.length).toBe(1)
    expect(view.state.selection.from).toBe(5)
    expect(view.state.selection.to).toBe(10)
    expect(screen.queryByRole("menu")).toBeNull()

    // Click simple en ⋮⋮: node-range sobre SOLO ese bloque (p 5..10) + menú abierto.
    fireEvent.mouseDown(screen.getByTestId("block-handle"))
    fireEvent.click(screen.getByTestId("block-handle"))
    const sel = view.state.selection as unknown as { ranges: unknown[] }
    expect(sel.ranges.length).toBe(1)
    expect(view.state.selection.from).toBe(5)
    expect(view.state.selection.to).toBe(10)

    // Shift+mousedown en ⋮⋮ de "Tres" (p 10..16, 4 chars): extiende desde el anchor (5).
    await hoverBlock(view, "Tres")
    fireEvent.mouseDown(screen.getByTestId("block-handle"), { shiftKey: true })
    const extended = view.state.selection as unknown as { ranges: unknown[] }
    expect(extended.ranges.length).toBe(2)
    expect(view.state.selection.from).toBe(5)
    expect(view.state.selection.to).toBe(16)
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

  test("aparece en la franja izquierda (host incluido) y se esconde fuera de la zona", async () => {
    const { view, container, onChange } = await setup()
    hidden()
    stackRects(view)
    const h = hostEl(container)
    expect(view.state.doc.child(1).textContent).toBe("Dos")

    // La franja izquierda: mousemove que no cae en el contenteditable (el listener vive
    // en document — el asa vive fuera del box del host).
    fireEvent.mouseMove(h, { clientX: -40, clientY: 36 }) // mitad del bloque "Dos"
    await waitFor(visible)

    // Columna de contenido (x al centro del texto): esconder.
    fireEvent.mouseMove(h, { clientX: 50, clientY: 36 })
    await waitFor(hidden)

    // Franja otra vez y debajo del último bloque: aparecer y esconder.
    fireEvent.mouseMove(h, { clientX: -40, clientY: 36 })
    await waitFor(visible)
    fireEvent.mouseMove(h, { clientX: -40, clientY: 999 })
    await waitFor(hidden)

    // El target del mapeo es "Dos": el menú del asa (abierta desde la franja) opera sobre él.
    fireEvent.mouseMove(h, { clientX: -40, clientY: 36 })
    await waitFor(visible)
    fireEvent.keyDown(screen.getByTestId("block-handle"), { key: "Enter" })
    fireEvent.click(await screen.findByRole("menuitem", { name: /Convertir a/ }))
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Heading 1/ }))
    await settle()
    await waitFor(() => expect(lastDoc(onChange).content?.[1]?.type).toBe("heading"))
  })

  test("node-range activo: los gutters persisten (el asa vuelve al contrato hover) y al perder la selección se van", async () => {
    const { view } = await setup()
    hidden()
    stackRects(view)
    // node-range sobre "Dos" + "Tres".
    view.dispatch(view.state.tr.setSelection(NodeRangeSelection.create(view.state.doc, 5, 16)))
    await waitFor(() => expect(screen.getByTestId("range-add-10")).toBeTruthy())

    // El asa del plugin es hover puro: se esconde al salir; los gutters propios
    // persisten igual (la selección vive en el set de esta capa).
    fireEvent.mouseLeave(view.dom)
    fireEvent.mouseMove(view.dom, { clientX: 50, clientY: 500 })
    await waitFor(() => expect(screen.getByTestId("range-add-10")).toBeTruthy())

    // Selección de texto: los gutters se van (contrato hover otra vez).
    const pos = posOf(view, "Uno")
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 1)))
    await waitFor(() => expect(screen.queryByTestId("range-add-10")).toBeNull())
    await waitFor(hidden)
  })

  test("node-range: cada bloque seleccionado tiene su propio gutter (+ y ⋮⋮) activo", async () => {
    const { view, onChange } = await setup()
    stackRects(view)
    // node-range "Dos" + "Tres" (p 5..16) → gutters en pos 5 y pos 10.
    view.dispatch(view.state.tr.setSelection(NodeRangeSelection.create(view.state.doc, 5, 16)))
    await waitFor(() => expect(screen.getByTestId("range-add-5")).toBeTruthy())
    expect(screen.getByTestId("range-handle-5")).toBeTruthy()
    expect(screen.getByTestId("range-add-10")).toBeTruthy()
    expect(screen.getByTestId("range-handle-10")).toBeTruthy()

    // El + de un gutter inserta debajo de SU bloque (no del primero del rango).
    fireEvent.click(screen.getByTestId("range-add-10"))
    await waitFor(() => expect(docTexts(onChange)).toEqual(["Uno", "Dos", "Tres", ""]))

    // Selección de texto: los gutters propios desaparecen.
    const pos = posOf(view, "Uno")
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 1)))
    await waitFor(() => expect(screen.queryByTestId("range-add-10")).toBeNull())
  })

  test("multi-select NO contiguo: click en ⋮⋮ agrega bloques (this + next this)", async () => {
    const { view } = await setup()
    stackRects(view)
    // Click en ⋮⋮ del asa de hover sobre "Dos": agrega "Dos" al set (el gutter propio
    // no aparece aún: el asa del plugin está parada sobre él).
    await hoverBlock(view, "Dos")
    fireEvent.mouseDown(screen.getByTestId("block-handle"))
    fireEvent.click(screen.getByTestId("block-handle"))
    await waitFor(() =>
      expect(view.dom.querySelectorAll("p.ProseMirror-selectednoderange").length).toBeGreaterThan(
        0,
      ),
    )

    // Click en ⋮⋮ (asa de hover) sobre "Tres": AGREGA (no reemplaza) — set = Dos + Tres.
    // Al mover el hover a "Tres", el gutter propio de "Dos" aparece.
    await hoverBlock(view, "Tres")
    fireEvent.mouseDown(screen.getByTestId("block-handle"))
    fireEvent.click(screen.getByTestId("block-handle"))
    await waitFor(() => expect(screen.getByTestId("range-add-5")).toBeTruthy())

    // Ambos bloques con su halo ("Dos" etiquetado a mano, fuera del node-range de PM).
    expect(view.dom.querySelectorAll("p.ProseMirror-selectednoderange").length).toBe(2)

    // Al salir del editor: el asa se esconde y AMBOS gutters propios quedan activos.
    fireEvent.mouseLeave(view.dom)
    await waitFor(() => expect(screen.getByTestId("range-add-10")).toBeTruthy())
    expect(screen.getByTestId("range-add-5")).toBeTruthy()

    // Al perder la selección de bloques (texto), todo se limpia.
    const pos = posOf(view, "Uno")
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 1)))
    await waitFor(() => {
      expect(screen.queryByTestId("range-add-5")).toBeNull()
      expect(screen.queryByTestId("range-add-10")).toBeNull()
    })
  })

  test("⋮⋮ de un gutter no-primero abre el menú y opera sobre SU bloque", async () => {
    const { view, onChange } = await setup()
    stackRects(view)
    view.dispatch(view.state.tr.setSelection(NodeRangeSelection.create(view.state.doc, 5, 15)))
    await waitFor(() => expect(screen.getByTestId("range-handle-10")).toBeTruthy())
    // Radix abre el menú en pointerdown/keydown (jsdom: mismo patrón que el asa de hover).
    fireEvent.mouseDown(screen.getByTestId("range-handle-10"))
    fireEvent.keyDown(screen.getByTestId("range-handle-10"), { key: "Enter" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicar" }))
    await settle()
    await waitFor(() => expect(docTexts(onChange)).toEqual(["Uno", "Dos", "Tres", "Tres"]))
  })

  test("hover sobre un bloque seleccionado: el asa del plugin cubre SU gutter y vuelve al salir", async () => {
    const { view } = await setup()
    stackRects(view)
    view.dispatch(view.state.tr.setSelection(NodeRangeSelection.create(view.state.doc, 5, 16)))
    await waitFor(() => expect(screen.getByTestId("range-add-10")).toBeTruthy())
    expect(screen.getByTestId("range-add-5")).toBeTruthy()

    // Hover del asa del plugin sobre "Tres": el asa toma su lugar — el gutter propio
    // de "Tres" se retira (el de "Dos" sigue).
    await hoverBlock(view, "Tres")
    await waitFor(() => expect(screen.queryByTestId("range-handle-10")).toBeNull())
    expect(screen.getByTestId("range-add-5")).toBeTruthy()

    // Al salir del editor el asa del plugin se esconde: el gutter propio vuelve.
    fireEvent.mouseLeave(view.dom)
    await waitFor(() => expect(screen.getByTestId("range-handle-10")).toBeTruthy())
  })
})
