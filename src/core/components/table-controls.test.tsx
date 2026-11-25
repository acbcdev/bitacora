import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { Editor } from "@/core/components/editor"
import { moveAt, swapCells } from "@/core/components/table-controls"
import type { TiptapDoc } from "@/core/types/database"

// Contrato de tablas finas (.scratch/editor-notion-ux/spec.md, historia 5 / issue 04; UI
// "Fantasma" del prototipo .scratch/editor-tables):
// - Overlay de hover: ⋯ por celda (menú de fila + columna), grips de fila y columna.
// - Comandos vía menú: insertar/duplicar/eliminar fila y columna, toggle header.
// - Duplicar fila/columna es build propio (clone JSON); la columna duplicada pierde header.
// - "+ Nueva fila" / + de columna solo en la última fila/columna, agregan al final.
// - Swap de celdas: intercambia contenido, cada celda conserva su tipo.
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

test("hover muestra ⋯ y grips en cualquier celda; los + solo en la última fila/columna", async () => {
  const { container, view } = await setup()
  expect(screen.queryByTestId("table-controls")).toBeNull()
  // Celda "C" (última fila, col 0): solo "+ Nueva fila".
  await hoverCell(container, "C")
  expect(screen.getByTestId("table-cell-menu")).toBeTruthy()
  expect(screen.getByTestId("table-row-grip")).toBeTruthy()
  expect(screen.getByTestId("table-col-grip")).toBeTruthy()
  expect(screen.getByTestId("table-add-row")).toBeTruthy()
  expect(screen.queryByTestId("table-add-col")).toBeNull()
  // Celda "B" (primera fila, última columna): solo el + de columna.
  await hoverCell(container, "B")
  expect(screen.queryByTestId("table-add-row")).toBeNull()
  expect(screen.getByTestId("table-add-col")).toBeTruthy()
  // Celda "D" (última fila, última columna): los dos.
  await hoverCell(container, "D")
  expect(screen.getByTestId("table-add-row")).toBeTruthy()
  expect(screen.getByTestId("table-add-col")).toBeTruthy()
  // Al salir de la tabla (clientX lejos del borde) el overlay desaparece.
  fireEvent.mouseMove(view.dom, { target: view.dom, clientX: -1000, clientY: -1000 })
  await waitFor(() => expect(screen.queryByTestId("table-controls")).toBeNull())
})

test("fila/columna de encabezado no tienen grip (quedan fijas)", async () => {
  const { container } = await setup(
    doc(
      [
        ["A", "B"],
        ["C", "D"],
      ],
      true,
    ),
  )
  await hoverCell(container, "A")
  expect(screen.queryByTestId("table-row-grip")).toBeNull()
  expect(screen.getByTestId("table-col-grip")).toBeTruthy()
})

test("+ de columna agrega una columna al final de la tabla", async () => {
  const { container, onChange } = await setup()
  await hoverCell(container, "D")
  fireEvent.click(screen.getByTestId("table-add-col"))
  await waitFor(() => {
    const t = lastTable(onChange)
    expect(rowTexts(t)).toEqual(["AB", "CD"])
    expect(t.content[1].content).toHaveLength(3)
  })
})

test("+ Nueva fila agrega una fila al pie de la tabla", async () => {
  const { container, onChange } = await setup()
  await hoverCell(container, "C")
  fireEvent.click(screen.getByTestId("table-add-row"))
  await waitFor(() => expect(rowTexts(lastTable(onChange))).toEqual(["AB", "CD", ""]))
})

test("swapCells intercambia el contenido y cada celda conserva su tipo", async () => {
  const { container, view, onChange } = await setup(
    doc(
      [
        ["A", "B"],
        ["C", "D"],
      ],
      true,
    ),
  )
  const find = (text: string) =>
    [...container.querySelectorAll<HTMLElement>("td, th")].find((el) => el.textContent === text)!
  swapCells(view, find("D"), find("A"))
  await waitFor(() => {
    const t = lastTable(onChange)
    expect(rowTexts(t)).toEqual(["DB", "CA"])
    expect(cellTypes(t, 0)).toEqual(["tableHeader", "tableHeader"])
  })
})

test("moveAt mueve columna y fila aunque el caret esté fuera de la tabla", async () => {
  const { container, view, onChange } = await setup()
  const editor = (view.dom as HTMLElement & { editor: Parameters<typeof moveAt>[0] }).editor
  const find = (text: string) =>
    [...container.querySelectorAll<HTMLElement>("td, th")].find((el) => el.textContent === text)!
  // Caret en el párrafo antes de la tabla (el bug: el comando nativo lee la selección).
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
  moveAt(editor, find("A"), "col", 0, 2)
  await waitFor(() => expect(rowTexts(lastTable(onChange))).toEqual(["BA", "DC"]))
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
  moveAt(editor, find("D"), "row", 1, 0)
  await waitFor(() => expect(rowTexts(lastTable(onChange))).toEqual(["DC", "BA"]))
})

test("menú de fila: insertar arriba, duplicar y eliminar", async () => {
  const { container, onChange } = await setup()

  await hoverCell(container, "C")
  await openMenu("table-cell-menu")
  await pick(/Insertar arriba/)
  await waitFor(() => expect(rowTexts(lastTable(onChange))).toEqual(["AB", "", "CD"]))

  await hoverCell(container, "C")
  await openMenu("table-cell-menu")
  await pick(/Duplicar fila/)
  await waitFor(() => expect(rowTexts(lastTable(onChange))).toEqual(["AB", "", "CD", "CD"]))

  await hoverCell(container, "D")
  await openMenu("table-cell-menu")
  await pick(/Eliminar fila/)
  await waitFor(() => expect(rowTexts(lastTable(onChange))).toEqual(["AB", "", "CD"]))
})

test("menú de columna: insertar a la izquierda, duplicar y eliminar", async () => {
  const { container, onChange } = await setup()

  await hoverCell(container, "C")
  await openMenu("table-cell-menu")
  await pick(/Insertar a la izquierda/)
  await waitFor(() => expect(colTexts(lastTable(onChange))(1)).toBe("AC"))

  await hoverCell(container, "C")
  await openMenu("table-cell-menu")
  await pick(/Duplicar columna/)
  // La columna duplicada es copia de la de C: sale pegada a la derecha.
  await waitFor(() => expect(colTexts(lastTable(onChange))(2)).toBe("AC"))

  await hoverCell(container, "C")
  await openMenu("table-cell-menu")
  await pick(/Eliminar columna/)
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
  await openMenu("table-cell-menu")
  await pick(/Duplicar columna/)
  await waitFor(() =>
    expect(cellTypes(lastTable(onChange), 0)).toEqual(["tableHeader", "tableCell", "tableHeader"]),
  )
})

test("toggle de encabezado desde los menús", async () => {
  const { container, onChange } = await setup()

  // Fila de encabezado: el comando oficial de tiptap togglea la PRIMERA fila (semántica
  // de toggleHeaderRow — "only applies to first row/column").
  await hoverCell(container, "C")
  await openMenu("table-cell-menu")
  await pick(/Fila de encabezado/)
  await waitFor(() =>
    expect(cellTypes(lastTable(onChange), 0)).toEqual(["tableHeader", "tableHeader"]),
  )

  // Columna de encabezado: togglea la PRIMERA columna (salta la fila ya-header).
  await hoverCell(container, "C")
  await openMenu("table-cell-menu")
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
