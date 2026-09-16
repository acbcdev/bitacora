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

// ── Paste de imagen (upload via store.uploadNoteImage) ──────────────────────────────

const { uploadNoteImage } = vi.hoisted(() => ({ uploadNoteImage: vi.fn() }))
vi.mock("@/core/store", () => ({ store: { uploadNoteImage } }))

beforeEach(() => {
  uploadNoteImage.mockReset()
  uploadNoteImage.mockResolvedValue("https://cdn/img.png")
})

function pasteFile(container: HTMLElement, file: File) {
  const pm = container.querySelector<HTMLElement>(".ProseMirror")!
  fireEvent.paste(pm, {
    clipboardData: {
      items: [{ type: file.type, getAsFile: () => file }],
      getData: () => "",
    },
  })
}

test("pegar una imagen la sube y la inserta en el doc", async () => {
  const onChange = vi.fn()
  const { container } = render(<Editor content={doc} onChange={onChange} />)
  await waitFor(() => expect(container.querySelector(".ProseMirror")).toBeInTheDocument())

  pasteFile(container, new File(["x"], "foto.png", { type: "image/png" }))

  await waitFor(() => expect(uploadNoteImage).toHaveBeenCalledWith(expect.any(File)))
  await waitFor(() => {
    const last = onChange.mock.lastCall?.[0] as TiptapDoc | undefined
    expect(JSON.stringify(last)).toContain("https://cdn/img.png")
  })
  expect(container.querySelector("img")).toBeInTheDocument()
})

test("si falla el upload no inserta nada (el error va por toast)", async () => {
  uploadNoteImage.mockRejectedValue(new Error("máximo 500 KB"))
  const onChange = vi.fn()
  const { container } = render(<Editor content={doc} onChange={onChange} />)
  await waitFor(() => expect(container.querySelector(".ProseMirror")).toBeInTheDocument())

  pasteFile(container, new File(["x"], "foto.png", { type: "image/png" }))

  await waitFor(() => expect(uploadNoteImage).toHaveBeenCalled())
  expect(onChange).not.toHaveBeenCalled()
  expect(container.querySelector("img")).not.toBeInTheDocument()
})

test("pegar un archivo que no es imagen no sube nada", async () => {
  const { container } = render(<Editor content={doc} />)
  await waitFor(() => expect(container.querySelector(".ProseMirror")).toBeInTheDocument())

  pasteFile(container, new File(["x"], "apunte.pdf", { type: "application/pdf" }))

  expect(uploadNoteImage).not.toHaveBeenCalled()
})

// ── Tab: anidar ítems de lista (hijo del anterior) sin perder el foco ───────────

const listDoc = {
  type: "doc",
  content: [
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "uno" }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "dos" }] }],
        },
      ],
    },
  ],
} as TiptapDoc

function focusText(container: HTMLElement, text: string) {
  const pmEl = container.querySelector(".ProseMirror") as HTMLElement & {
    editor: {
      view: { state: PMEditorState; dispatch: (tr: PMTransaction) => void; dom: HTMLElement }
    }
  }
  const view = pmEl.editor.view
  let pos = 0
  view.state.doc.descendants((node, p) => {
    if (node.isText && node.text === text) {
      pos = p
      return false
    }
    return true
  })
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
  return view
}

test("Tab dentro de un ítem lo anida como hijo del anterior", async () => {
  const { container } = render(<Editor content={listDoc} />)
  const view = await waitFor(() => {
    expect(container.querySelector(".ProseMirror")).toBeInTheDocument()
    return focusText(container, "dos")
  })

  fireEvent.keyDown(view.dom, { key: "Tab" })

  await waitFor(() => expect(container.querySelector("li ul li")).toBeInTheDocument())
})

test("Shift+Tab desanida", async () => {
  const nestedDoc = {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "uno" }] },
              {
                type: "bulletList",
                content: [
                  {
                    type: "listItem",
                    content: [{ type: "paragraph", content: [{ type: "text", text: "dos" }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as TiptapDoc
  const { container } = render(<Editor content={nestedDoc} />)
  const view = await waitFor(() => {
    expect(container.querySelector("li ul li")).toBeInTheDocument()
    return focusText(container, "dos")
  })

  fireEvent.keyDown(view.dom, { key: "Tab", shiftKey: true })

  await waitFor(() => expect(container.querySelector("li ul li")).not.toBeInTheDocument())
})

test("Tab fuera de lista inserta 4 espacios y no saca el foco", async () => {
  const { container } = render(<Editor content={doc} />)
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  pm.focus()
  const view = focusText(container, "hola")

  fireEvent.keyDown(view.dom, { key: "Tab" })

  expect(pm.textContent).toContain("    hola")
  expect(document.activeElement).toBe(pm)

  // Shift+Tab borra el indent que insertó Tab
  fireEvent.keyDown(view.dom, { key: "Tab", shiftKey: true })
  expect(pm.textContent).not.toContain("    hola")
})
