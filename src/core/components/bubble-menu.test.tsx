import { fireEvent, render, waitFor } from "@testing-library/react"
import { TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import type { Editor as TiptapEditor } from "@tiptap/react"
import { Editor } from "@/core/components/editor"
import { PALETTE } from "@/core/components/bubble-menu"
import type { TiptapDoc } from "@/core/types/database"

// Contrato de teclado y bubble de formato (.scratch/editor-notion-ux/spec.md, historias 3 y 4;
// ADR 0019): mod+B es del sidebar (el editor lo suelta), bold = mod+Alt+B, mod+\ limpia todas
// las marks (incluidas color y highlight). Bubble: fila de 7 con isActive por control y
// paleta fija de 8 — ficha activa quita.

const doc = (text = "hola mundo") =>
  ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  }) as TiptapDoc

async function setup(initial?: string) {
  const { container } = render(<Editor content={doc(initial)} />)
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  pm.focus()
  const view = (pm as HTMLElement & { editor: { view: EditorView } }).editor.view
  const editor = (pm as HTMLElement & { editor: TiptapEditor }).editor
  return { container, pm, view, editor }
}

// Click con la secuencia real del browser: mousedown (que el componente previene para no
// robar la selección/foco) + click. fireEvent.click solo, en jsdom, saca el foco del editor.
function press(el: Element) {
  fireEvent.mouseDown(el)
  fireEvent.click(el)
}

// Selecciona todo el texto del primer párrafo (jsdom no soporta el path de drag-select de PM).
function selectText(view: EditorView) {
  const end = view.state.doc.content.firstChild!.content.size
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, end + 1)))
}

// Colores de la paleta por posición (fuera de paleta → ✕ o "Quitar", el escape hatch).
const ROJO = PALETTE[7].text
const ROJO_BG = PALETTE[7].bg
const AZUL = PALETTE[5].text

// ── Historia 3: teclado (ADR 0019) ────────────────────────────────────────────

test("mod+b NO togglea bold — la tecla es del sidebar (ADR 0019)", async () => {
  const { pm, view, editor } = await setup()
  selectText(view)
  fireEvent.keyDown(pm, { key: "b", ctrlKey: true })
  expect(editor.isActive("bold")).toBe(false)
})

test("mod+alt+b togglea bold", async () => {
  const { pm, view, editor } = await setup()
  selectText(view)
  fireEvent.keyDown(pm, { key: "b", ctrlKey: true, altKey: true })
  expect(editor.isActive("bold")).toBe(true)
  fireEvent.keyDown(pm, { key: "b", ctrlKey: true, altKey: true })
  expect(editor.isActive("bold")).toBe(false)
})

test("mod+\\ limpia todas las marks, incluidas color y highlight", async () => {
  const { pm, view, editor } = await setup()
  selectText(view)
  editor.commands.setColor(ROJO)
  editor.commands.setHighlight({ color: ROJO_BG })
  editor.commands.toggleBold()
  expect(editor.isActive("bold")).toBe(true)
  expect(editor.isActive("textStyle", { color: ROJO })).toBe(true)
  expect(editor.isActive("highlight", { color: ROJO_BG })).toBe(true)

  fireEvent.keyDown(pm, { key: "\\", ctrlKey: true })
  expect(editor.isActive("bold")).toBe(false)
  expect(editor.isActive("textStyle", { color: ROJO })).toBe(false)
  expect(editor.isActive("highlight", { color: ROJO_BG })).toBe(false)
})

// ── Historia 4: bubble de formato ──────────────────────────────────────

const BUBBLE = "[data-testid=bubble-menu]"
const item = (bubble: Element, label: string) => bubble.querySelector(`[aria-label="${label}"]`)!

async function openPalette(kind: "color" | "highlight") {
  const label = kind === "color" ? "Color de letra" : "Resaltado"
  press(item(document.body, label))
  return waitFor(() => {
    const grid = document.body.querySelector(`[data-testid=palette-${kind}-0]`)
    if (!grid) throw new Error("popover no montado")
    return grid.parentElement!
  })
}

// Estado activo por control vía editor.isActive: aplicando las marks, los toggles correspondientes
// del bubble quedan data-state=on. El mark code es excluyente (default de Tiptap): se prueba aparte.
test("isActive por control: B, I, S, code, A y H reflejan las marks activas", async () => {
  const { view, editor } = await setup()
  selectText(view)
  editor.commands.toggleBold()
  editor.commands.toggleItalic()
  editor.commands.toggleStrike()
  editor.commands.setColor(ROJO)
  editor.commands.setHighlight({ color: ROJO_BG })

  const bubble = await waitFor(() => document.body.querySelector(BUBBLE)!)
  await waitFor(() => {
    expect(item(bubble, "Bold")).toHaveAttribute("data-state", "on")
    expect(item(bubble, "Itálica")).toHaveAttribute("data-state", "on")
    expect(item(bubble, "Tachado")).toHaveAttribute("data-state", "on")
  })
  // Mini-preview: los íconos de A y H pintan el color activo.
  expect(item(bubble, "Color de letra").querySelector("svg")).toHaveStyle({ color: ROJO })
  expect(item(bubble, "Resaltado").querySelector("svg")).toHaveStyle({
    backgroundColor: ROJO_BG,
  })

  // Code es excluyente: solo, con sus toggles hermanos en off.
  editor.commands.unsetAllMarks()
  editor.commands.toggleCode()
  await waitFor(() => {
    expect(item(bubble, "Código inline")).toHaveAttribute("data-state", "on")
    expect(item(bubble, "Bold")).toHaveAttribute("data-state", "off")
  })
})

test("paleta fija: 8 fichas en cada popover, ficha activa quita, Quitar quita", async () => {
  const { view, editor } = await setup()
  selectText(view)
  const bubble = await waitFor(() => document.body.querySelector(BUBBLE)!)

  // Color: 8 fichas; aplicar rojo activa el mark.
  const colors = await openPalette("color")
  expect(colors.querySelectorAll("[data-testid^=palette-color]")).toHaveLength(8)
  press(document.body.querySelector("[data-testid=palette-color-7]")!)
  expect(editor.isActive("textStyle", { color: ROJO })).toBe(true)

  // Reabrir: la ficha activa quedó marcada; clickarla de nuevo quita el color.
  await openPalette("color")
  expect(document.body.querySelector("[data-testid=palette-color-7]")).toHaveAttribute(
    "data-active",
  )
  press(document.body.querySelector("[data-testid=palette-color-7]")!)
  expect(editor.isActive("textStyle", { color: ROJO })).toBe(false)

  // Highlight: 8 fichas y Quitar desactiva el mark.
  editor.commands.setHighlight({ color: ROJO_BG })
  const highlights = await openPalette("highlight")
  expect(highlights.querySelectorAll("[data-testid^=palette-highlight]")).toHaveLength(8)
  press(document.body.querySelector("[data-testid=clear-highlight]")!)
  expect(editor.isActive("highlight", { color: ROJO_BG })).toBe(false)

  // ✕ limpia todo, también las marks que el bubble acabó de aplicar.
  editor.commands.toggleBold()
  editor.commands.setColor(AZUL)
  press(item(bubble, "Limpiar formato"))
  expect(editor.isActive("bold")).toBe(false)
  expect(editor.isActive("textStyle", { color: AZUL })).toBe(false)
})

// Toggle inline por click del bubble: B aplica bold sin robar la selección (mousedown
// preventDefault), y el estado del toggle se refleja en el DOM.
test("click en B del bubble togglea bold", async () => {
  const { view, editor } = await setup()
  selectText(view)
  const bubble = await waitFor(() => document.body.querySelector(BUBBLE)!)
  press(item(bubble, "Bold"))
  expect(editor.isActive("bold")).toBe(true)
  press(item(bubble, "Bold"))
  expect(editor.isActive("bold")).toBe(false)
})

// Esc con un popover de color abierto: cierra SOLO el popover (capture), el foco queda en el
// editor y la selección no vacía sigue en pie.
test("Esc con popover abierto cierra el popover y no saca el foco del editor", async () => {
  const { pm, view, editor } = await setup()
  selectText(view)
  await openPalette("color")
  fireEvent.keyDown(document.body, { key: "Escape", bubbles: true })
  await waitFor(() =>
    expect(document.body.querySelector("[data-testid=palette-color-0]")).toBeNull(),
  )
  expect(pm.contains(document.activeElement)).toBe(true)
  expect(view.state.selection.empty).toBe(false)
  expect(editor.isActive("bold")).toBe(false)
})
