import { docToMarkdown, markdownToDoc } from "@/core/lib/tiptap-markdown"
import type { TiptapDoc } from "@/core/types/database"

// El export NO negociable (notes/03): preservar headings, listas, código, énfasis.
test("preserva estructura del documento Tiptap", () => {
  const doc: TiptapDoc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Título" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "hola " },
          { type: "text", marks: [{ type: "bold" }], text: "mundo" },
          { type: "text", text: " y " },
          { type: "text", marks: [{ type: "code" }], text: "code" },
        ],
      },
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
      {
        type: "codeBlock",
        attrs: { language: "ts" },
        content: [{ type: "text", text: "const x = 1" }],
      },
    ],
  }

  expect(docToMarkdown(doc)).toBe(
    ["## Título", "hola **mundo** y `code`", "- uno\n- dos", "```ts\nconst x = 1\n```"].join(
      "\n\n",
    ),
  )
})

test("doc vacío no rompe", () => {
  expect(docToMarkdown({ type: "doc", content: [] })).toBe("")
})

// Pegar Markdown plano (notes/04): el texto crudo se vuelve nodos formateados, no texto literal.
test("markdownToDoc parsea headings, marcas, listas y code block", () => {
  const md = [
    "## Título",
    "hola **mundo** y `code`",
    "- uno",
    "- dos",
    "```ts",
    "const x = 1",
    "```",
  ].join("\n")

  expect(markdownToDoc(md)).toEqual({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Título" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "hola " },
          { type: "text", marks: [{ type: "bold" }], text: "mundo" },
          { type: "text", text: " y " },
          { type: "text", marks: [{ type: "code" }], text: "code" },
        ],
      },
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
      {
        type: "codeBlock",
        attrs: { language: "ts" },
        content: [{ type: "text", text: "const x = 1" }],
      },
    ],
  })
})

test("markdownToDoc con texto plano sin sintaxis produce un párrafo", () => {
  expect(markdownToDoc("solo texto")).toEqual({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "solo texto" }] }],
  })
})
