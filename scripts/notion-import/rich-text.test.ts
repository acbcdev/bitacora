import type { RichTextItemResponse } from "@notionhq/client"
import { richTextToInline } from "./rich-text"

// Fixtures con la forma real de la API (ver node_modules/@notionhq/client/build/src/api-endpoints/common.d.ts).
function textItem(
  content: string,
  overrides: {
    link?: string | null
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    underline?: boolean
    code?: boolean
    href?: string | null
  } = {},
): RichTextItemResponse {
  return {
    type: "text",
    text: { content, link: overrides.link ? { url: overrides.link } : null },
    plain_text: content,
    href: overrides.href !== undefined ? overrides.href : (overrides.link ?? null),
    annotations: {
      bold: overrides.bold ?? false,
      italic: overrides.italic ?? false,
      strikethrough: overrides.strikethrough ?? false,
      underline: overrides.underline ?? false,
      code: overrides.code ?? false,
      color: "default",
    },
  }
}

test("plain text sin marks", () => {
  const nodes = richTextToInline([textItem("hola mundo")])
  expect(nodes).toEqual([{ type: "text", text: "hola mundo" }])
})

test("bold + italic combinados", () => {
  const nodes = richTextToInline([textItem("fuerte", { bold: true, italic: true })])
  expect(nodes).toEqual([
    { type: "text", text: "fuerte", marks: [{ type: "bold" }, { type: "italic" }] },
  ])
})

test("code mark", () => {
  const nodes = richTextToInline([textItem("const x = 1", { code: true })])
  expect(nodes).toEqual([{ type: "text", text: "const x = 1", marks: [{ type: "code" }] }])
})

test("strikethrough y underline", () => {
  const nodes = richTextToInline([textItem("tachado", { strikethrough: true, underline: true })])
  expect(nodes).toEqual([
    { type: "text", text: "tachado", marks: [{ type: "strike" }, { type: "underline" }] },
  ])
})

test("link externo se preserva", () => {
  const nodes = richTextToInline([textItem("MDN", { link: "https://developer.mozilla.org" })])
  expect(nodes).toEqual([
    {
      type: "text",
      text: "MDN",
      marks: [{ type: "link", attrs: { href: "https://developer.mozilla.org" } }],
    },
  ])
})

test("link interno a notion.so se aplana a texto plano", () => {
  const nodes = richTextToInline([
    textItem("otra nota", { link: "https://www.notion.so/workspace/otra-nota-abc123" }),
  ])
  expect(nodes).toEqual([{ type: "text", text: "otra nota" }])
})

test("mention de página (link interno vía href) se aplana a texto plano", () => {
  const mention: RichTextItemResponse = {
    type: "mention",
    mention: { type: "page", page: { id: "abc-123" } },
    plain_text: "Historia de JavaScript",
    href: "https://www.notion.so/abc123",
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
    },
  }
  const nodes = richTextToInline([mention])
  expect(nodes).toEqual([{ type: "text", text: "Historia de JavaScript" }])
})

test("saltos de línea dentro de un item generan hardBreak", () => {
  const nodes = richTextToInline([textItem("línea 1\nlínea 2")])
  expect(nodes).toEqual([
    { type: "text", text: "línea 1" },
    { type: "hardBreak" },
    { type: "text", text: "línea 2" },
  ])
})

test("item vacío no genera nodo de texto", () => {
  const nodes = richTextToInline([textItem("")])
  expect(nodes).toEqual([])
})

test("múltiples items concatenan en orden", () => {
  const nodes = richTextToInline([textItem("hola "), textItem("mundo", { bold: true })])
  expect(nodes).toEqual([
    { type: "text", text: "hola " },
    { type: "text", text: "mundo", marks: [{ type: "bold" }] },
  ])
})
