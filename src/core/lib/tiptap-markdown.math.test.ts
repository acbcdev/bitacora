import { expect, test } from "vitest"
import { docToMarkdown, markdownToDoc } from "@/core/lib/tiptap-markdown"
import type { TiptapDoc } from "@/core/types/database"

const para = (...content: object[]): TiptapDoc =>
  ({ type: "doc", content: [{ type: "paragraph", content }] }) as TiptapDoc

test("export: inlineMath → $…$, blockMath → $$…$$ en línea propia", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Euler: " },
          { type: "inlineMath", attrs: { latex: "e^{i\\pi}+1=0" } },
        ],
      },
      { type: "blockMath", attrs: { latex: "\\sum_{i=1}^n x_i" } },
    ],
  } as TiptapDoc
  expect(docToMarkdown(doc)).toBe("Euler: $e^{i\\pi}+1=0$\n\n$$\\sum_{i=1}^n x_i$$")
})

test("parse: $$…$$ en línea propia = blockMath, corta el párrafo", () => {
  expect(markdownToDoc("antes\n$$x^2$$\ndespués").content).toEqual([
    { type: "paragraph", content: [{ type: "text", text: "antes" }] },
    { type: "blockMath", attrs: { latex: "x^2" } },
    { type: "paragraph", content: [{ type: "text", text: "después" }] },
  ])
})

test("parse: $…$ inline con regla pandoc", () => {
  expect(markdownToDoc("agua $H_2O$ y $x^2$.")).toEqual(
    para(
      { type: "text", text: "agua " },
      { type: "inlineMath", attrs: { latex: "H_2O" } },
      { type: "text", text: " y " },
      { type: "inlineMath", attrs: { latex: "x^2" } },
      { type: "text", text: "." },
    ),
  )
})

test.each(["cuesta $5 y $10", "de $ 5 a $", "entre $x $ y", "$a$1 dólar", "`$x$` en código"])(
  "parse: %s no es ecuación",
  (md) => {
    const [p] = markdownToDoc(md).content as { content: { type: string }[] }[]
    const nodes = p.content
    expect(nodes.every((n) => n.type === "text")).toBe(true)
  },
)

test("round-trip inline y bloque", () => {
  const md = "Euler: $e^{i\\pi}+1=0$ fin\n\n$$\\int_0^1 f(x)\\,dx$$\n\ncuesta $5 y $10"
  expect(docToMarkdown(markdownToDoc(md))).toBe(md)
})
