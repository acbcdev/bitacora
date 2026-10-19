import { fireEvent, render, waitFor } from "@testing-library/react"
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

test("renderiza con KaTeX y clic edita el LaTeX", async () => {
  vi.spyOn(window, "prompt").mockReturnValue("e^{i\\pi}+1=0")
  const onChange = vi.fn()
  const { container } = render(<Editor content={doc("x")} onChange={onChange} />)
  fireEvent.click(await mathEl(container))
  await waitFor(() => {
    expect(container.querySelector("[data-type=inline-math]")).toHaveAttribute(
      "data-latex",
      "e^{i\\pi}+1=0",
    )
    expect(container.querySelector(".katex")).toBeInTheDocument()
  })
  expect(onChange).toHaveBeenCalled()
})

test("cancelar el prompt no cambia nada", async () => {
  vi.spyOn(window, "prompt").mockReturnValue(null)
  const onChange = vi.fn()
  const { container } = render(<Editor content={doc("x")} onChange={onChange} />)
  fireEvent.click(await mathEl(container))
  expect(onChange).not.toHaveBeenCalled()
})

test("sintaxis rota muestra el texto crudo", async () => {
  const { container } = render(<Editor content={doc("\\frac{")} />)
  const el = await mathEl(container)
  expect(el.textContent).toBe("\\frac{")
  expect(el.querySelector(".katex")).toBeNull()
})
