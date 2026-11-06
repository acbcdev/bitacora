import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Editor } from "@/core/components/editor"
import type { TiptapDoc } from "@/core/types/database"

// Ecuación (editor-blocks/02): KaTeX renderiza, clic edita el LaTeX, sintaxis rota no rompe.
const doc = (latex: string) =>
  ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "inlineMath", attrs: { latex } }] }],
  }) as TiptapDoc

const mathEl = (container: HTMLElement) =>
  waitFor(() => container.querySelector<HTMLElement>("[data-type=inline-math]")!)

const latexOf = (container: HTMLElement) =>
  container.querySelector("[data-type=inline-math]")?.getAttribute("data-latex")

test("clic abre el editor y la ecuación del doc se actualiza en vivo", async () => {
  const onChange = vi.fn()
  const { container } = render(<Editor content={doc("x")} onChange={onChange} />)
  fireEvent.click(await mathEl(container))
  const input = await screen.findByLabelText("LaTeX")
  expect(input).toHaveValue("x")
  fireEvent.change(input, { target: { value: "e^{i\\pi}+1=0" } })
  // Preview = el nodo mismo, antes de confirmar.
  await waitFor(() => expect(latexOf(container)).toBe("e^{i\\pi}+1=0"))
  expect(container.querySelector(".katex")).toBeInTheDocument()
  fireEvent.keyDown(input, { key: "Enter" })
  await waitFor(() => expect(screen.queryByLabelText("LaTeX")).toBeNull())
  expect(latexOf(container)).toBe("e^{i\\pi}+1=0")
  expect(onChange).toHaveBeenCalled()
})

test("Esc restaura el LaTeX original", async () => {
  const { container } = render(<Editor content={doc("x")} />)
  fireEvent.click(await mathEl(container))
  const input = await screen.findByLabelText("LaTeX")
  fireEvent.change(input, { target: { value: "y" } })
  await waitFor(() => expect(latexOf(container)).toBe("y"))
  fireEvent.keyDown(input, { key: "Escape" })
  await waitFor(() => expect(screen.queryByLabelText("LaTeX")).toBeNull())
  expect(latexOf(container)).toBe("x")
})

test("Listo con LaTeX vacío borra la ecuación", async () => {
  const { container } = render(<Editor content={doc("x")} />)
  fireEvent.click(await mathEl(container))
  fireEvent.change(await screen.findByLabelText("LaTeX"), { target: { value: "  " } })
  fireEvent.click(screen.getByRole("button", { name: /Listo/ }))
  await waitFor(() => expect(container.querySelector("[data-type=inline-math]")).toBeNull())
})

test("sintaxis rota muestra el texto crudo", async () => {
  const { container } = render(<Editor content={doc("\\frac{")} />)
  const el = await mathEl(container)
  expect(el.textContent).toBe("\\frac{")
  expect(el.querySelector(".katex")).toBeNull()
})

test("copiar con ecuaciones: text/plain estilo Notion, sin text/html, y pegar adentro las recupera", async () => {
  const onChange = vi.fn()
  const { container } = render(<Editor content={doc("x^2")} onChange={onChange} />)
  await mathEl(container)
  const pm = container.querySelector<
    HTMLElement & { editor: { commands: { selectAll(): void; clearContent(): void } } }
  >(".ProseMirror")!
  pm.editor.commands.selectAll()
  const data: Record<string, string> = {}
  const clipboardData = {
    clearData: () => {},
    setData: (t: string, v: string) => (data[t] = v),
    getData: (t: string) => data[t] ?? "",
  }
  fireEvent.copy(pm, { clipboardData })
  expect(data["text/plain"]).toBe("$$x^2$$")
  expect(data["text/html"]).toBeUndefined()

  pm.editor.commands.clearContent()
  await waitFor(() => expect(container.querySelector("[data-type=inline-math]")).toBeNull())
  fireEvent.paste(pm, { clipboardData })
  await waitFor(() => expect(latexOf(container)).toBe("x^2"))
})
