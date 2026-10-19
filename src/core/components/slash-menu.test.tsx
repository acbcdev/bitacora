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

const selected = (popup: Element) =>
  [...popup.querySelectorAll("[cmdk-item]")].find(
    (el) => el.getAttribute("aria-selected") === "true",
  )?.textContent

// Navegación: flechas mueven el highlight visual (value controlado de cmdk) y Enter inserta el ítem resaltado.
test("ArrowDown/ArrowUp mueven el ítem seleccionado con wrap", async () => {
  const { view } = await setup()
  const popup = await openMenu(view, "")
  const n = items(popup).length
  expect(selected(popup)).toBe("Heading 1")
  fireEvent.keyDown(view.dom as HTMLElement, { key: "ArrowDown" })
  await waitFor(() => expect(selected(popup)).toBe("Heading 2"))
  // Wrap: n-1 flechas más desde el índice 1 → n ≡ 0 (mod n), vuelve al primero. Relativo al
  // largo de la lista: el conteo exacto lo fija el test de abajo.
  for (let i = 0; i < n - 1; i++) fireEvent.keyDown(view.dom as HTMLElement, { key: "ArrowDown" })
  await waitFor(() => expect(selected(popup)).toBe("Heading 1"))
  // Wrap hacia arriba: del primero va al último.
  fireEvent.keyDown(view.dom as HTMLElement, { key: "ArrowUp" })
  await waitFor(() => expect(selected(popup)).toBe("Imagen"))
})

// Caso reportado: 1×ArrowUp desde el primer ítem debe envolver directo al último (no en el 2º
// keypress); 1×ArrowDown en el último debe envolver directo al primero.
test("wrap inmediato en ambos bordes", async () => {
  const { view } = await setup()
  const popup = await openMenu(view, "")
  expect(selected(popup)).toBe("Heading 1")
  fireEvent.keyDown(view.dom as HTMLElement, { key: "ArrowUp" })
  await waitFor(() => expect(selected(popup)).toBe("Imagen"))
  fireEvent.keyDown(view.dom as HTMLElement, { key: "ArrowDown" })
  await waitFor(() => expect(selected(popup)).toBe("Heading 1"))
})

test("hover mueve la selección y Enter inserta el ítem resaltado", async () => {
  const { view, onChange } = await setup()
  const popup = await openMenu(view, "")
  const item = [...popup.querySelectorAll("[cmdk-item]")].find(
    (el) => el.textContent === "Heading 3",
  )!
  fireEvent.pointerMove(item)
  await waitFor(() => expect(selected(popup)).toBe("Heading 3"))
  fireEvent.keyDown(view.dom as HTMLElement, { key: "Enter" })
  await waitFor(() => {
    const json = onChange.mock.lastCall?.[0] as TiptapDoc | undefined
    const p = json?.content?.[0] as { type: string; attrs?: { level: number } } | undefined
    expect(p?.type).toBe("heading")
    expect(p?.attrs?.level).toBe(3)
  })
})

// Con más ítems que el alto visible (max-h-72), mover la selección scrollea el ítem a la vista.
test("navegar más allá del alto visible scrollea el ítem seleccionado", async () => {
  const { view } = await setup()
  await openMenu(view, "")
  const spy = vi.spyOn(Element.prototype, "scrollIntoView")
  try {
    // 6 flechas: el ítem seleccionado sale de la vista (lista ≈ 9 ítems visibles en max-h-72).
    for (let i = 0; i < 6; i++) fireEvent.keyDown(view.dom as HTMLElement, { key: "ArrowDown" })
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ block: "nearest" }))
  } finally {
    spy.mockRestore()
  }
})

// ── Trigger ──────────────────────────────────────────────────────────────────

test("`/` al inicio de un bloque abre el popup con los ítems", async () => {
  const { view } = await setup()
  const popup = await openMenu(view, "")
  // 16 ítems: Heading 1/2/3 + lista viñetas + numerada + to-do + cita + desplegable + nota +
  // aviso + tip + código + ecuación + divisor + tabla + imagen.
  expect(items(popup)).toHaveLength(16)
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

// Callout (editor-blocks/03): /nota, /aviso, /tip envuelven el bloque; el tipo lo dice un ícono
// lucide (nunca emoji, docs/design-system.md); click en el ícono rota el tipo y llega al JSON
// persistido (onChange).
test.each([
  ["nota", "note", "lucide-info"],
  ["aviso", "warning", "lucide-triangle-alert"],
  ["tip", "tip", "lucide-lightbulb"],
])("/%s envuelve el bloque en un Callout %s", async (query, kind, icon) => {
  const { container, view, onChange } = await setup("hola")
  await openMenu(view, query)
  fireEvent.keyDown(view.dom as HTMLElement, { key: "Enter" })
  await waitFor(() => {
    const json = onChange.mock.lastCall?.[0] as TiptapDoc | undefined
    const c = json?.content?.[0] as { type: string; attrs?: { kind: string } } | undefined
    expect(c?.type).toBe("callout")
    expect(c?.attrs?.kind).toBe(kind)
    expect(JSON.stringify(c)).toContain("hola")
  })
  const button = container.querySelector(".callout-icon")!
  expect(button.querySelector(`svg.${icon}`)).toBeInTheDocument()
  expect(button.textContent).toBe("")
})

// "Nota" a secas chocaría con la entidad Nota en la búsqueda del menú: título "Callout nota",
// keyword `/nota` intacta.
test("/nota lista el ítem como Callout nota", async () => {
  const { view } = await setup()
  const popup = await openMenu(view, "nota")
  expect(items(popup)).toEqual(["Callout nota"])
})

test("click en el ícono rota nota → aviso → tip → nota y el tipo sobrevive recargar", async () => {
  const { container, view, onChange } = await setup("hola")
  await openMenu(view, "nota")
  fireEvent.keyDown(view.dom as HTMLElement, { key: "Enter" })
  const button = await waitFor(() => {
    const found = container.querySelector<HTMLElement>(".callout-icon")
    if (!found) throw new Error("callout no montado")
    return found
  })
  const saved = () => onChange.mock.lastCall?.[0] as TiptapDoc
  const kind = () => (saved().content?.[0] as { attrs?: { kind: string } } | undefined)?.attrs?.kind
  for (const next of ["warning", "tip", "note", "warning"]) {
    fireEvent.click(button)
    await waitFor(() => expect(kind()).toBe(next))
  }
  // Recargar: el JSON guardado vuelve a montar un Callout aviso.
  const reloaded = render(<Editor content={saved()} onChange={vi.fn()} />)
  await waitFor(() =>
    expect(
      reloaded.container.querySelector(".callout-icon svg.lucide-triangle-alert"),
    ).toBeInTheDocument(),
  )
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

test("seleccionar Ecuación pide el LaTeX e inserta un bloque renderizado", async () => {
  vi.spyOn(window, "prompt").mockReturnValue("x^2")
  const { container, view } = await setup()
  await openMenu(view, "ecuacion")
  fireEvent.keyDown(view.dom as HTMLElement, { key: "Enter" })
  await waitFor(() => {
    const math = container.querySelector("[data-type=block-math]")!
    expect(math.getAttribute("data-latex")).toBe("x^2")
    expect(math.querySelector(".katex")).toBeInTheDocument()
  })
})

// ── Desplegable (editor-blocks/01) ───────────────────────────────────────────
// Plegado = estado de vista: el node view alterna `is-open` + `hidden` en el DOM, sin
// transacción → onChange no se llama (no ensucia el borrador).

const details = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-type=details]")
const isOpen = (container: HTMLElement) => details(container)?.classList.contains("is-open")

test("/desplegable envuelve el bloque y lo abre para escribir el cuerpo", async () => {
  const { container, view, onChange } = await setup("hola")
  await openMenu(view, "desplegable")
  fireEvent.keyDown(view.dom as HTMLElement, { key: "Enter" })
  await waitFor(() => {
    const json = onChange.mock.lastCall?.[0] as TiptapDoc | undefined
    const d = json?.content?.[0] as { type: string; content: { type: string }[] } | undefined
    expect(d?.type).toBe("details")
    expect(d?.content.map((n) => n.type)).toEqual(["detailsSummary", "detailsContent"])
    expect(JSON.stringify(d?.content[1])).toContain("hola")
  })
  expect(isOpen(container)).toBe(true)
  // Cursor en el título, listo para escribir.
  expect(view.state.selection.$from.parent.type.name).toBe("detailsSummary")
})

test("`> ` + espacio crea Desplegable, no cita", async () => {
  const { container, view } = await setup()
  type(view, ">")
  const { from } = view.state.selection
  view.someProp("handleTextInput", (f) => f(view, from, from, " ", () => view.state.tr))
  await waitFor(() => expect(isOpen(container)).toBe(true))
  expect(view.state.doc.firstChild?.type.name).toBe("details")
  expect(container.querySelector("blockquote")).toBeNull()
})

test("nota abre con los desplegables cerrados; plegar con mouse y teclado no ensucia", async () => {
  const onChange = vi.fn()
  const content = {
    type: "doc",
    content: [
      {
        type: "details",
        content: [
          { type: "detailsSummary", content: [{ type: "text", text: "Título" }] },
          {
            type: "detailsContent",
            content: [{ type: "paragraph", content: [{ type: "text", text: "cuerpo" }] }],
          },
        ],
      },
      // Párrafo final: sin él, TrailingNode (StarterKit) lo agrega en la 1ra transacción y eso sí
      // es docChanged — no el plegado.
      { type: "paragraph" },
    ],
  } as TiptapDoc
  const { container } = render(<Editor content={content} onChange={onChange} />)
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  const view = (pm as HTMLElement & { editor: { view: EditorView } }).editor.view
  expect(isOpen(container)).toBe(false)
  expect(container.querySelector("[data-type=detailsContent]")).toHaveAttribute("hidden")

  fireEvent.click(details(container)!.querySelector(":scope > button")!)
  expect(isOpen(container)).toBe(true)
  expect(container.querySelector("[data-type=detailsContent]")).not.toHaveAttribute("hidden")

  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)))
  fireEvent.keyDown(view.dom as HTMLElement, { key: "Enter", ctrlKey: true, shiftKey: true })
  expect(isOpen(container)).toBe(false)
  expect(onChange).not.toHaveBeenCalled()
})
