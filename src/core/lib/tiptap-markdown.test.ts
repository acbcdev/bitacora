import { docToMarkdown, docToPlainText, markdownToDoc } from "@/core/lib/tiptap-markdown"
import type { TiptapDoc } from "@/core/types/database"

type TestNode = {
  type: string
  content?: TestNode[]
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string }[]
}

function cell(text: string): TestNode {
  return {
    type: "tableCell",
    content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
  }
}

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

// Extracto para el card de Repaso (review-note-dialog): sin símbolos de formato ni marks.
test("docToPlainText saca el texto sin símbolos de formato", () => {
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
    ],
  }

  expect(docToPlainText(doc)).toBe("Título hola mundo y code uno dos")
})

test("docToPlainText de un doc vacío es un string vacío", () => {
  expect(docToPlainText({ type: "doc", content: [] })).toBe("")
})

test("markdownToDoc con texto plano sin sintaxis produce un párrafo", () => {
  expect(markdownToDoc("solo texto")).toEqual({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "solo texto" }] }],
  })
})

// Tablas GFM (spec .scratch/editor-tables): paste `| a | b |` se convierte en nodos table.
test("markdownToDoc parsea tabla GFM con header", () => {
  expect(markdownToDoc("| a | b |\n|---|---|\n|1|2|\n|3|4|")).toEqual({
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
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                content: [{ type: "paragraph", content: [{ type: "text", text: "3" }] }],
              },
              {
                type: "tableCell",
                content: [{ type: "paragraph", content: [{ type: "text", text: "4" }] }],
              },
            ],
          },
        ],
      },
    ],
  })
})

test("tabla GFM admite pipes externos opcionales y alineación en el separador", () => {
  const doc = markdownToDoc("a | b\n --- | :---:")
  const table = doc.content![0] as { type: string; content?: { type: string }[] }
  expect(table.type).toBe("table")
  expect(table.content?.map((r) => r.type)).toEqual(["tableRow"])
})

// Línea con pipes sin separador NO es tabla (mayormente texto con links [-x-](url)).
test("párrafo con pipes sin línea separadora no es tabla", () => {
  expect(markdownToDoc("a | b")).toEqual({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "a | b" }] }],
  })
})

// GFM exige que el separador tenga la misma cantidad de celdas que el header: "texto | con
// pipes" seguido de un --- de horizontal rule no debe comerse el texto como tabla.
test("texto con pipes + HR de un guion no es tabla", () => {
  expect(markdownToDoc("Resumen | notas\n---\ncuerpo")).toEqual({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Resumen | notas" }] },
      { type: "horizontalRule" },
      { type: "paragraph", content: [{ type: "text", text: "cuerpo" }] },
    ],
  })
})

// Como GFM: la tabla termina ante otro bloque (heading con pipe incluido), no lo consume.
test("heading con pipe después de la tabla no se come como fila", () => {
  const doc = markdownToDoc("| a | b |\n|---|---|\n|1|2|\n# Título | notas")
  const nodes = doc.content as TestNode[]
  expect(nodes.map((n) => n.type)).toEqual(["table", "heading"])
  expect(nodes[1].content![0].text).toBe("Título | notas")
})

test("tabla sin filas de datos (solo header) se parsea igual", () => {
  const doc = markdownToDoc("| a |\n|---|")
  const table = doc.content![0] as { type: string; content?: unknown[] }
  expect(table.type).toBe("table")
  expect(table.content).toHaveLength(1)
})

test("celda vacía en tabla produce paragraph vacío", () => {
  const doc = markdownToDoc("| a | b |\n|---|---|\n| | 2 |")
  const table = doc.content![0] as {
    content: { content: { content: { type: string; content?: unknown[] }[] }[] }[]
  }
  const para = table.content[1].content[0].content[0]
  expect(para.type).toBe("paragraph")
  expect(para.content).toEqual([])
})

// Round-trip: docToMarkdown serializa la tabla de vuelta a GFM.
test("docToMarkdown serializa tabla a GFM", () => {
  const doc = markdownToDoc("| a | b |\n|---|---|\n|1|2|")
  expect(docToMarkdown(doc)).toBe("| a | b |\n| --- | --- |\n| 1 | 2 |")
})

test("docToMarkdown agrega celdas faltantes para filas irregulares", () => {
  const doc: TiptapDoc = {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          { type: "tableRow", content: [cell("a"), cell("b")] },
          { type: "tableRow", content: [cell("1")] },
        ],
      },
    ],
  }
  expect(docToMarkdown(doc)).toBe("| a | b |\n| --- | --- |\n| 1 |  |")
})

test("docToPlainText aplana celdas separadas por espacio", () => {
  const doc = markdownToDoc("| a | b |\n|---|---|\n|1|2|")
  expect(docToPlainText(doc)).toBe("a b 1 2")
})
