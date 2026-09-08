import { fireEvent, render, waitFor } from "@testing-library/react"
import { Editor } from "@/core/components/editor"
import { TextSelection } from "@tiptap/pm/state"
import type { Transaction as PMTransaction } from "@tiptap/pm/state"
import type { EditorState as PMEditorState } from "@tiptap/pm/state"
import type { TiptapDoc } from "@/core/types/database"

const doc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hola" }] }],
} as TiptapDoc

test("un solo Esc saca el foco del editor", async () => {
  const { container } = render(<Editor content={doc} />)
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  pm.focus()

  fireEvent.keyDown(pm, { key: "Escape" })
  expect(document.activeElement).not.toBe(pm)
})

// ── Tablas (spec .scratch/editor-tables) ─────────────────────────────────────

const tableDoc = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
            },
            {
              type: "tableHeader",
              content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "1" }] }],
            },
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "2" }] }],
            },
          ],
        },
      ],
    },
  ],
} as TiptapDoc

function findTd(container: HTMLElement, text: string): HTMLElement {
  const tds = [...container.querySelectorAll("td")]
  const td = tds.find((el) => el.textContent === text)
  if (!td) throw new Error(`no td con texto "${text}"`)
  return td
}

test("tabla TiptapDoc se renderiza como table semántica", async () => {
  const { container } = render(<Editor content={tableDoc} />)
  await waitFor(() => expect(container.querySelector("table")).toBeInTheDocument())
  expect(container.querySelectorAll("th")).toHaveLength(2)
  expect(findTd(container, "1")).toBeInTheDocument()
})

test("editar el texto de una celda dispara onChange con el texto nuevo", async () => {
  const onChange = vi.fn()
  const { container } = render(<Editor content={tableDoc} onChange={onChange} />)
  await waitFor(() => expect(findTd(container, "1")).toBeInTheDocument())
  onChange.mockClear()

  // jsdom no soporta el path de keystrokes de ProseMirror (coords/selection sync). Se setea el
  // caret dentro de la celda via la EditorView de PM (expuesta como dom.editor) y se inserta
  // texto — cubre celda editable → onUpdate → onChange con JSON nuevo.
  const pmEl = container.querySelector(".ProseMirror") as HTMLElement & {
    editor: { view: { state: PMEditorState; dispatch: (tr: PMTransaction) => void } }
  }
  const view = pmEl.editor.view
  let end = 0
  view.state.doc.descendants((node, pos) => {
    if (node.isText && node.text === "1") {
      end = pos + node.nodeSize
      return false
    }
    return true
  })
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, end))
  view.dispatch(tr.insertText("9"))

  await waitFor(() => {
    const last = onChange.mock.lastCall?.[0] as TiptapDoc | undefined
    expect(JSON.stringify(last)).toContain('"text":"19"')
  })
})

// Paste Markdown de tabla (story 2): el handlePaste convierte `| a | b |` en nodos table.
test("pegar Markdown de tabla genera una tabla en el DOM", async () => {
  const { container } = render(<Editor content={doc} />)
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  pm.focus()
  fireEvent.paste(pm, {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" ? "| x | y |\n|---|---|\n|7|8|" : ""),
    },
  })

  await waitFor(() => {
    expect(container.querySelector("th")?.textContent).toBe("x")
    expect(findTd(container, "7")).toBeInTheDocument()
  })
})

// Scroll horizontal mobile (story 3): la clase overflow-x-auto vive en el tag table (renderHTML).
test("la tabla tiene overflow-x auto para scroll horizontal", async () => {
  const { container } = render(<Editor content={tableDoc} />)
  await waitFor(() => expect(container.querySelector("table")).toBeInTheDocument())
  expect(container.querySelector("table")?.className).toContain("overflow-x-auto")
})
