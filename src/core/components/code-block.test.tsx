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
