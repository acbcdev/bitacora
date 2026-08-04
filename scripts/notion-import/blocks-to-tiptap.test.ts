import type { RichTextItemResponse } from "@notionhq/client"
import { blocksToTiptap, type ResolvedBlock } from "./blocks-to-tiptap"

function rt(text: string): RichTextItemResponse[] {
  return [
    {
      type: "text",
      text: { content: text, link: null },
      plain_text: text,
      href: null,
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default",
      },
    },
  ]
}

const COMMON = {
  object: "block" as const,
  id: "block-id",
  created_time: "2025-01-01T00:00:00.000Z",
  created_by: { object: "user" as const, id: "user-id" },
  last_edited_time: "2025-01-01T00:00:00.000Z",
  last_edited_by: { object: "user" as const, id: "user-id" },
  in_trash: false,
  archived: false,
  parent: { type: "page_id" as const, page_id: "page-id" },
}

function block(partial: Record<string, unknown>, children: ResolvedBlock[] = []): ResolvedBlock {
  return { ...COMMON, has_children: children.length > 0, children, ...partial } as ResolvedBlock
}

test("paragraph", () => {
  const doc = blocksToTiptap([
    block({ type: "paragraph", paragraph: { rich_text: rt("hola"), color: "default" } }),
  ])
  expect(doc).toEqual([{ type: "paragraph", content: [{ type: "text", text: "hola" }] }])
})

test("heading_1 a heading_3", () => {
  const doc = blocksToTiptap([
    block({
      type: "heading_1",
      heading_1: { rich_text: rt("Título"), color: "default", is_toggleable: false },
    }),
  ])
  expect(doc).toEqual([
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Título" }] },
  ])
})

test("bulleted_list_item consecutivos se agrupan en un bulletList", () => {
  const doc = blocksToTiptap([
    block({
      type: "bulleted_list_item",
      bulleted_list_item: { rich_text: rt("uno"), color: "default" },
    }),
    block({
      type: "bulleted_list_item",
      bulleted_list_item: { rich_text: rt("dos"), color: "default" },
    }),
  ])
  expect(doc).toEqual([
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
  ])
})

test("numbered_list_item consecutivos se agrupan en un orderedList", () => {
  const doc = blocksToTiptap([
    block({
      type: "numbered_list_item",
      numbered_list_item: { rich_text: rt("uno"), color: "default" },
    }),
    block({
      type: "numbered_list_item",
      numbered_list_item: { rich_text: rt("dos"), color: "default" },
    }),
  ])
  expect(doc).toEqual([
    {
      type: "orderedList",
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
  ])
})

test("bulleted y numbered separados no se mezclan en la misma lista", () => {
  const doc = blocksToTiptap([
    block({
      type: "bulleted_list_item",
      bulleted_list_item: { rich_text: rt("a"), color: "default" },
    }),
    block({
      type: "numbered_list_item",
      numbered_list_item: { rich_text: rt("b"), color: "default" },
    }),
  ])
  expect(doc.map((n) => n.type)).toEqual(["bulletList", "orderedList"])
})

test("list item con hijos anidados", () => {
  const doc = blocksToTiptap([
    block(
      {
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: rt("padre"), color: "default" },
      },
      [block({ type: "paragraph", paragraph: { rich_text: rt("hijo"), color: "default" } })],
    ),
  ])
  expect(doc).toEqual([
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "padre" }] },
            { type: "paragraph", content: [{ type: "text", text: "hijo" }] },
          ],
        },
      ],
    },
  ])
})

test("code block con lenguaje", () => {
  const doc = blocksToTiptap([
    block({
      type: "code",
      code: { rich_text: rt("const x = 1"), caption: [], language: "javascript" },
    }),
  ])
  expect(doc).toEqual([
    {
      type: "codeBlock",
      attrs: { language: "javascript" },
      content: [{ type: "text", text: "const x = 1" }],
    },
  ])
})

test("quote", () => {
  const doc = blocksToTiptap([
    block({ type: "quote", quote: { rich_text: rt("cita"), color: "default" } }),
  ])
  expect(doc).toEqual([
    {
      type: "blockquote",
      content: [{ type: "paragraph", content: [{ type: "text", text: "cita" }] }],
    },
  ])
})

test("imagen (url ya resuelta a Supabase Storage)", () => {
  const doc = blocksToTiptap([
    block({
      type: "image",
      image: {
        type: "external",
        external: { url: "https://supabase.example/notes-images/x.png" },
        caption: [],
      },
    }),
  ])
  expect(doc).toEqual([
    { type: "image", attrs: { src: "https://supabase.example/notes-images/x.png" } },
  ])
})

test("divider", () => {
  const doc = blocksToTiptap([block({ type: "divider", divider: {} })])
  expect(doc).toEqual([{ type: "horizontalRule" }])
})

test("child_database se ignora (metadata de la DB de notas, no contenido)", () => {
  const doc = blocksToTiptap([
    block({ type: "child_database", child_database: { title: "Notas" } }),
  ])
  expect(doc).toEqual([])
})

test("bloque sin equivalente con rich_text usa fallback a paragraph", () => {
  const doc = blocksToTiptap([
    block({
      type: "to_do",
      to_do: { rich_text: rt("pendiente"), color: "default", checked: false },
    }),
  ])
  expect(doc).toEqual([{ type: "paragraph", content: [{ type: "text", text: "pendiente" }] }])
})

test("toggle aplana su rich_text y sus hijos al mismo nivel", () => {
  const doc = blocksToTiptap([
    block({ type: "toggle", toggle: { rich_text: rt("resumen"), color: "default" } }, [
      block({
        type: "paragraph",
        paragraph: { rich_text: rt("detalle oculto"), color: "default" },
      }),
    ]),
  ])
  expect(doc).toEqual([
    { type: "paragraph", content: [{ type: "text", text: "resumen" }] },
    { type: "paragraph", content: [{ type: "text", text: "detalle oculto" }] },
  ])
})

test("columnas sin rich_text propio igual conservan el contenido anidado", () => {
  const doc = blocksToTiptap([
    block({ type: "column_list", column_list: {} }, [
      block({ type: "column", column: {} }, [
        block({ type: "paragraph", paragraph: { rich_text: rt("en columna"), color: "default" } }),
      ]),
    ]),
  ])
  expect(doc).toEqual([{ type: "paragraph", content: [{ type: "text", text: "en columna" }] }])
})

test("bloque sin equivalente y sin rich_text se descarta", () => {
  const doc = blocksToTiptap([
    block({
      type: "table",
      table: { table_width: 2, has_column_header: false, has_row_header: false },
    }),
  ])
  expect(doc).toEqual([])
})
