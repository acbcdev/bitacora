import { fireEvent, render, waitFor } from "@testing-library/react"
import { TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { Editor } from "@/core/components/editor"
import type { TiptapDoc } from "@/core/types/database"

// Contrato del Menú slash (.scratch/editor-notion-ux/spec.md, historia 2):
// - Trigger: `/` al inicio de bloque o precedido de espacio; nunca a mitad de palabra.
// - Popup con los 10 ítems, filtrado excluyente case-insensitive.
// - On-select: transformaciones convierten el bloque entero; inserciones parten el párrafo.
// - Esc restaura el `/` literal; espacio cierra (o confirma con match único).

const POPUP = "[data-testid=slash-menu]"

const doc = (text: string) =>
  ({
    type: "doc",
    content: text
      ? [{ type: "paragraph", content: [{ type: "text", text }] }]
      : [{ type: "paragraph" }],
  }) as TiptapDoc

async function setup(initial = "") {
  const onChange = vi.fn()
  const { container } = render(<Editor content={doc(initial)} onChange={onChange} />)
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  pm.focus()
  const view = (pm as HTMLElement & { editor: { view: EditorView } }).editor.view
  return { container, view, onChange }
}

// jsdom no soporta el path de keystrokes de ProseMirror (ver editor.test.tsx): el tipeo se
// simula con transacciones (el plugin de Suggestion detecta el match en apply(), no en keydown).
const type = (view: EditorView, text: string) => view.dispatch(view.state.tr.insertText(text))

async function openMenu(view: EditorView, text: string) {
  type(view, "/")
  if (text) type(view, text)
  const popup = await waitFor(() => {
    const found = document.body.querySelector(POPUP)
    if (!found) throw new Error("popup no montado")
    return found
  })
  // Los ítems llegan async (el plugin hace fetch en un microtask y el re-render de React es
  // posterior al montaje): settle antes de teclar — es el timing real de un usuario.
  await new Promise((r) => setTimeout(r, 50))
  return popup
}

const items = (popup: Element) =>
  [...popup.querySelectorAll("[data-slot=command-item]")].map((el) => el.textContent)

// ── Trigger ──────────────────────────────────────────────────────────────────

test("`/` al inicio de un bloque abre el popup con los ítems", async () => {
  const { view } = await setup()
  const popup = await openMenu(view, "")
  // 11 ítems: Heading 1/2/3 + lista viñetas + numerada + to-do + cita + código + divisor +
  // tabla + imagen (la spec dice "(10)" pero enumera 11 — la enumeración es la lista operativa).
  expect(items(popup)).toHaveLength(11)
  expect(items(popup)).toContain("Heading 1")
  expect(items(popup)).toContain("Imagen")
})

test("`/` precedido de espacio abre el popup", async () => {
  const { view } = await setup("hola")
  type(view, " ")
  await openMenu(view, "")
})

test("`/` a mitad de palabra no abre el popup", async () => {
  const { view } = await setup("palabra")
  // Cursor al final del texto: tipear `/` ahí queda a mitad de palabra.
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, 1 + "palabra".length)),
  )
  type(view, "/")
  await new Promise((r) => setTimeout(r, 50))
  expect(document.body.querySelector(POPUP)).not.toBeInTheDocument()
})

// ── Filtrado ─────────────────────────────────────────────────────────────────

test("escribir filtra los ítems excluyente y case-insensitive (`h1` → Heading 1)", async () => {
  const { view } = await setup()
  const popup = await openMenu(view, "h1")
  expect(items(popup)).toEqual(["Heading 1"])
})

test("sin match muestra 'Sin resultados'", async () => {
  const { view } = await setup()
  const popup = await openMenu(view, "zzz")
  expect(popup.textContent).toContain("Sin resultados")
})

// ── Cierre y dismiss ─────────────────────────────────────────────────────────

test("un espacio después del query cierra el popup sin insertar nada", async () => {
  const { view, onChange } = await setup()
  await openMenu(view, "h1")
  type(view, " ")
  await waitFor(() => expect(document.body.querySelector(POPUP)).not.toBeInTheDocument())
  // El texto queda tal cual: "/h1 " sin transformación.
  expect(JSON.stringify(onChange.mock.lastCall?.[0])).toContain('"text":"/h1 "')
})

test("Esc cierra el popup y restaura el `/` como texto literal", async () => {
  const { container, view, onChange } = await setup()
  await openMenu(view, "h1")
  fireEvent.keyDown(container.querySelector(".ProseMirror")!, { key: "Escape" })
  await waitFor(() => expect(document.body.querySelector(POPUP)).not.toBeInTheDocument())
  expect(JSON.stringify(onChange.mock.lastCall?.[0])).toContain('"text":"/h1"')
})

test("espacio con match único confirma la selección (comportamiento Notion)", async () => {
  const { view, onChange } = await setup()
  await openMenu(view, "h1")
  fireEvent.keyDown(view.dom as HTMLElement, { key: " " })
  await waitFor(() => {
    const json = onChange.mock.lastCall?.[0] as TiptapDoc | undefined
    expect(JSON.stringify(json)).toContain('"type":"heading"')
  })
  expect(JSON.stringify(onChange.mock.lastCall?.[0])).not.toContain('"text"')
})

// ── On-select: transformaciones convierten el bloque entero ──────────────────

test("seleccionar Heading 1 con Enter convierte el bloque entero del cursor", async () => {
  const { view, onChange } = await setup("hola mundo")
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1 + 5)))
  await openMenu(view, "h1")
  fireEvent.keyDown(view.dom as HTMLElement, { key: "Enter" })
  await waitFor(() => {
    const json = onChange.mock.lastCall?.[0] as TiptapDoc | undefined
    const p = json?.content?.[0] as { type: string; attrs?: { level: number }; content?: unknown[] }
    expect(p.type).toBe("heading")
    expect(p.attrs?.level).toBe(1)
    expect(JSON.stringify(p.content)).toContain("hola mundo")
  })
})

test("seleccionar Cita convierte el bloque entero del cursor", async () => {
  const { view, onChange } = await setup("hola mundo")
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1 + 5)))
  await openMenu(view, "cita")
  fireEvent.keyDown(view.dom as HTMLElement, { key: "Enter" })
  await waitFor(() => {
    const json = onChange.mock.lastCall?.[0] as TiptapDoc | undefined
    expect((json?.content?.[0] as { type: string } | undefined)?.type).toBe("blockquote")
  })
})

// ── On-select: inserciones parten el párrafo en el cursor ────────────────────

test("seleccionar Divisor parte el párrafo en el cursor", async () => {
  const { container, view } = await setup("hola mundo")
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1 + 5)))
  await openMenu(view, "divisor")
  fireEvent.keyDown(view.dom as HTMLElement, { key: "Enter" })
  await waitFor(() => {
    expect(container.querySelector("hr")).toBeInTheDocument()
    const ps = [...container.querySelectorAll(".ProseMirror > p")].map((p) => p.textContent)
    // El espacio previo al `/` queda en el primer bloque (deleteRange solo borra `/query`).
    expect(ps).toEqual(["hola ", "mundo"])
  })
})

test("seleccionar Tabla inserta una tabla 2x2 sin header row", async () => {
  const { container, view } = await setup()
  await openMenu(view, "tabla")
  fireEvent.keyDown(view.dom as HTMLElement, { key: "Enter" })
  await waitFor(() => {
    expect(container.querySelector("table")).toBeInTheDocument()
    expect(container.querySelectorAll("th")).toHaveLength(0)
    expect(container.querySelectorAll("td")).toHaveLength(4)
  })
})
