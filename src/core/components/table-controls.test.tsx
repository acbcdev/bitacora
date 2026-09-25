import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { Editor } from "@/core/components/editor"
import type { TiptapDoc } from "@/core/types/database"

// Contrato de tablas finas (.scratch/editor-notion-ux/spec.md, historia 5 / issue 04):
// - Overlay de hover: ⋮⋮ y + para fila, ▾ y + para columna.
// - Comandos vía menú: insertar/duplicar/eliminar fila y columna, toggle header.
// - Duplicar fila/columna es build propio (clone JSON); la columna duplicada pierde header.
// - El + de fila/columna agrega al final de la tabla (estilo Notion); los menús, pegado.
// - Tab dentro de celda salta a la siguiente (y crea fila en la última), no inserta indentación.

beforeAll(() => {
  // jsdom no implementa elementFromPoint: lo usa el plugin de resize de columnas de
  // prosemirror-tables en cada mousemove. Con null, posAtCoords corta limpio.
  document.elementFromPoint = () => null
})

const cell = (text: string, header = false) => ({
  type: header ? "tableHeader" : "tableCell",
  content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
})

const doc = (rows: string[][], headerRow = false) =>
  ({
    type: "doc",
    content: [
      { type: "paragraph" },
      {
        type: "table",
        content: rows.map((r, i) => ({
          type: "tableRow",
          content: r.map((c) => cell(c, headerRow && i === 0)),
        })),
      },
    ],
  }) as TiptapDoc

async function setup(initial?: TiptapDoc) {
  const onChange = vi.fn()
  const { container } = render(
    <Editor
      content={
        initial ??
        doc([
          ["A", "B"],
          ["C", "D"],
        ])
      }
      onChange={onChange}
    />,
  )
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  pm.focus()
  const view = (pm as HTMLElement & { editor: { view: EditorView } }).editor.view
  return { container, view, onChange }
}

type TableJSON = {
  content: Array<{
    type: string
    content: Array<{ type: string; content?: Array<{ content?: Array<{ text?: string }> }> }>
  }>
}

// Estado del doc tras cada acción, leído del JSON del onChange (última llamada).
const lastTable = (onChange: ReturnType<typeof vi.fn>): TableJSON => {
  const d = onChange.mock.lastCall?.[0] as TiptapDoc
  const nodes = (d.content ?? []) as unknown as Array<{ type: string; content?: unknown }>
  return nodes.find((n) => n.type === "table") as unknown as TableJSON
}

const rowTexts = (t: TableJSON) =>
  t.content.map((r) => r.content.map((c) => c.content?.[0]?.content?.[0]?.text ?? "").join(""))

const colTexts = (t: TableJSON) => (col: number) =>
  t.content.map((r) => r.content[col]?.content?.[0]?.content?.[0]?.text ?? "").join("")

const cellTypes = (t: TableJSON, row: number) => t.content[row].content.map((c) => c.type)

// Hover: mousemove sobre la celda con el texto dado (se re-consulta cada vez: el DOM se
// reemplaza en cada mutación del doc).
async function hoverCell(container: HTMLElement, text: string) {
  const td = await waitFor(() => {
    const found = [...container.querySelectorAll("td, th")].find((el) => el.textContent === text)
    if (!found) throw new Error(`no celda con texto "${text}"`)
    return found
  })
  fireEvent.mouseMove(td, { target: td })
  await waitFor(() => expect(screen.getByTestId("table-controls")).toBeTruthy())
}

// Radix abre el DropdownMenu con pointerdown; en jsdom es más estable por teclado
// (Enter en el trigger), el mismo camino que usa un usuario navegando con tab.
async function openMenu(testid: string) {
  fireEvent.keyDown(screen.getByTestId(testid), { key: "Enter" })
  return screen.findByRole("menu")
}

async function pick(label: RegExp | string) {
  fireEvent.click(await screen.findByRole("menuitem", { name: label }))
  // El menú se cierra y la transacción del editor cae en el siguiente tick: settle.
  await new Promise((r) => setTimeout(r, 30))
}

test("hover sobre una celda muestra los 4 controles; fuera de tabla no hay overlay", async () => {
  const { container, view } = await setup()
  expect(screen.queryByTestId("table-controls")).toBeNull()
  await hoverCell(container, "C")
  expect(screen.getByTestId("table-row-menu")).toBeTruthy()
  expect(screen.getByTestId("table-row-add")).toBeTruthy()
  expect(screen.getByTestId("table-col-menu")).toBeTruthy()
  expect(screen.getByTestId("table-col-add")).toBeTruthy()
  // Al salir de la tabla el overlay desaparece.
  fireEvent.mouseMove(view.dom, { target: view.dom })
  await waitFor(() => expect(screen.queryByTestId("table-controls")).toBeNull())
})

test("+ de fila agrega una columna al final de la tabla", async () => {
  const { container, onChange } = await setup()
  await hoverCell(container, "C")
  fireEvent.click(screen.getByTestId("table-row-add"))
  await waitFor(() => {
    const t = lastTable(onChange)
    expect(rowTexts(t)).toEqual(["AB", "CD"])
    expect(t.content[1].content).toHaveLength(3)
  })
})

test("+ de columna agrega una fila al pie de la tabla", async () => {
  const { container, onChange } = await setup()
  await hoverCell(container, "A")
  fireEvent.click(screen.getByTestId("table-col-add"))
  await waitFor(() => expect(rowTexts(lastTable(onChange))).toEqual(["AB", "CD", ""]))
})

test("menú de fila: insertar arriba, duplicar y eliminar", async () => {
  const { container, onChange } = await setup()

  await hoverCell(container, "C")
  await openMenu("table-row-menu")
  await pick(/Insertar arriba/)
  await waitFor(() => expect(rowTexts(lastTable(onChange))).toEqual(["AB", "", "CD"]))

  await hoverCell(container, "C")
  await openMenu("table-row-menu")
  await pick(/Duplicar/)
  await waitFor(() => expect(rowTexts(lastTable(onChange))).toEqual(["AB", "", "CD", "CD"]))

  await hoverCell(container, "D")
  await openMenu("table-row-menu")
  await pick(/Eliminar/)
  await waitFor(() => expect(rowTexts(lastTable(onChange))).toEqual(["AB", "", "CD"]))
})

test("menú de columna: insertar a la izquierda, duplicar y eliminar", async () => {
  const { container, onChange } = await setup()

  await hoverCell(container, "C")
  await openMenu("table-col-menu")
  await pick(/Insertar a la izquierda/)
  await waitFor(() => expect(colTexts(lastTable(onChange))(1)).toBe("AC"))

  await hoverCell(container, "C")
  await openMenu("table-col-menu")
  await pick(/Duplicar/)
  // La columna duplicada es copia de la de C: sale pegada a la derecha.
  await waitFor(() => expect(colTexts(lastTable(onChange))(2)).toBe("AC"))

  await hoverCell(container, "C")
  await openMenu("table-col-menu")
  await pick(/Eliminar/)
  // Al borrar la columna de C quedan: la vacía insertada, la duplicada y la original.
  await waitFor(() => {
    const t = lastTable(onChange)
    expect(colTexts(t)(1)).toBe("AC")
    expect(colTexts(t)(2)).toBe("BD")
  })
})

test("duplicar columna pierde el header (la copia sale como celda común)", async () => {
  const { container, onChange } = await setup(
    doc(
      [
        ["A", "B"],
        ["C", "D"],
      ],
      true,
    ),
  )
  await hoverCell(container, "A")
  await openMenu("table-col-menu")
  await pick(/Duplicar/)
  await waitFor(() =>
    expect(cellTypes(lastTable(onChange), 0)).toEqual(["tableHeader", "tableCell", "tableHeader"]),
  )
})

test("toggle de encabezado desde los menús", async () => {
  const { container, onChange } = await setup()

  // Fila de encabezado: el comando oficial de tiptap togglea la PRIMERA fila (semántica
  // de toggleHeaderRow — "only applies to first row/column").
  await hoverCell(container, "C")
  await openMenu("table-row-menu")
  await pick(/Fila de encabezado/)
  await waitFor(() =>
    expect(cellTypes(lastTable(onChange), 0)).toEqual(["tableHeader", "tableHeader"]),
  )

  // Columna de encabezado: togglea la PRIMERA columna (salta la fila ya-header).
  await hoverCell(container, "C")
  await openMenu("table-col-menu")
  await pick(/Columna de encabezado/)
  await waitFor(() => {
    const t = lastTable(onChange)
    expect(cellTypes(t, 1)[0]).toBe("tableHeader")
  })
})

test("Tab dentro de una celda salta a la siguiente; en la última crea fila", async () => {
  const { container, view, onChange } = await setup()

  // Selección en la primera celda (el usuario hizo click ahí): Tab va a la celda "B".
  const first = [...container.querySelectorAll("td")].find((c) => c.textContent === "A")!
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, view.posAtDOM(first, 0))),
  )
  fireEvent.keyDown(view.dom, { key: "Tab" })
  // goToNextCell mueve la selección fuera de la celda "A" y no inserta indentación.
  expect(view.state.doc.textContent).not.toContain("    ")
  await waitFor(() => {
    const t = lastTable(onChange)
    expect(t).toBeTruthy()
  })

  // Selección en la última celda: Tab crea una fila nueva (default de ProseMirror).
  const last = [...container.querySelectorAll("td")].find((c) => c.textContent === "D")!
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, view.posAtDOM(last, 0))),
  )
  fireEvent.keyDown(view.dom, { key: "Tab" })
  await waitFor(() => expect(rowTexts(lastTable(onChange))).toEqual(["AB", "CD", ""]))
})

test("Tab fuera de tabla sigue insertando indentación (no cambia el default)", async () => {
  const { container, view } = await setup()
  const para = container.querySelector(".ProseMirror p")!
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, view.posAtDOM(para, 0))),
  )
  fireEvent.keyDown(view.dom, { key: "Tab" })
  expect(view.state.doc.textContent).toContain("    ")
})
