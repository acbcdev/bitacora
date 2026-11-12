import { fireEvent, render, screen } from "@testing-library/react"
import { Editor } from "@/core/components/editor"
import type { TiptapDoc } from "@/core/types/database"

const writeText = vi.fn()
Object.assign(navigator, { clipboard: { writeText } })

// jsdom no implementa lo que Radix usa para posicionar/scrollear el popup del Select.
Object.assign(HTMLElement.prototype, {
  hasPointerCapture: () => false,
  releasePointerCapture: () => {},
  setPointerCapture: () => {},
  scrollIntoView: () => {},
})

const doc = {
  type: "doc",
  content: [
    {
      type: "codeBlock",
      attrs: { language: "typescript" },
      content: [{ type: "text", text: "const a = 1" }],
    },
  ],
} as TiptapDoc

test("el code block muestra el lenguaje y copia su contenido", async () => {
  render(<Editor content={doc} />)

  expect(await screen.findByLabelText("Lenguaje del bloque")).toHaveTextContent("typescript")

  fireEvent.click(screen.getByLabelText("Copiar código"))
  expect(writeText).toHaveBeenCalledWith("const a = 1")
})

test("elegir otro lenguaje en el select actualiza el nodo", async () => {
  const onChange = vi.fn<(doc: TiptapDoc) => void>()
  render(<Editor content={doc} onChange={onChange} />)

  fireEvent.keyDown(await screen.findByLabelText("Lenguaje del bloque"), { key: "Enter" })
  fireEvent.click(await screen.findByRole("option", { name: "python" }))

  const [block] = onChange.mock.lastCall![0].content as [{ attrs: unknown }]
  expect(block.attrs).toEqual({ language: "python" })
})

test("el toggle de wrap ajusta las líneas del bloque", async () => {
  render(<Editor content={doc} />)

  const toggle = await screen.findByLabelText("Ajustar líneas")
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute("aria-pressed", "true")
  expect(document.querySelector("pre")).toHaveClass("whitespace-pre-wrap")
})

test("formatear reescribe el bloque con prettier y conserva el highlight", async () => {
  const onChange = vi.fn<(doc: TiptapDoc) => void>()
  // Párrafo antes: el cursor queda fuera del bloque, como al hacer click en el botón.
  const withParagraph = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }, ...doc.content!],
  } as TiptapDoc
  render(<Editor content={withParagraph} onChange={onChange} />)

  fireEvent.click(await screen.findByLabelText("Formatear código"))

  await vi.waitFor(() => {
    const block = onChange.mock.lastCall![0].content![1] as { content: [{ text: string }] }
    expect(block.content[0].text).toBe("const a = 1;")
  })
  expect(document.querySelector("pre .hljs-keyword")).toHaveTextContent("const")
})
