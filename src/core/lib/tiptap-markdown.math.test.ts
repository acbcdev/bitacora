import { expect, test } from "vitest"
import { docToMarkdown, docToPlainText, markdownToDoc } from "@/core/lib/tiptap-markdown"
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

test("plain text (extracto de Repaso, ADR 0018): Ecuaciones emiten su LaTeX crudo", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Euler " },
          { type: "inlineMath", attrs: { latex: "e^{i\\pi}" } },
        ],
      },
      { type: "blockMath", attrs: { latex: "x^2" } },
    ],
  } as TiptapDoc
  expect(docToPlainText(doc)).toBe("Euler e^{i\\pi} x^2")
})

test("round-trip: blockMath multilínea vuelve como un solo bloque", () => {
  const latex = "\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}"
  const doc = { type: "doc", content: [{ type: "blockMath", attrs: { latex } }] } as TiptapDoc
  expect(markdownToDoc(docToMarkdown(doc))).toEqual(doc)
})

test("parse: $$ en líneas propias (paste de ChatGPT) = blockMath", () => {
  expect(markdownToDoc("antes\n$$\na = b\n$$\ndespués").content).toEqual([
    { type: "paragraph", content: [{ type: "text", text: "antes" }] },
    { type: "blockMath", attrs: { latex: "a = b" } },
    { type: "paragraph", content: [{ type: "text", text: "después" }] },
  ])
})

test("parse: $$ sin cierre queda texto", () => {
  expect(markdownToDoc("$$\na = b").content).toEqual([
    {
      type: "paragraph",
      content: [
        { type: "text", text: "$$" },
        { type: "hardBreak" },
        { type: "text", text: "a = b" },
      ],
    },
  ])
})

// Decisión: al pegar, $$x$$ en medio de una línea NO es ecuación (solo $…$ inline). Pendiente de
// confirmar con el usuario — escribir $$x$$ sí la crea (input rule de Tiptap).
test("parse: $$x$$ en medio de una línea queda texto literal", () => {
  expect(markdownToDoc("antes $$x$$ después")).toEqual(
    para({ type: "text", text: "antes $$x$$ después" }),
  )
})
