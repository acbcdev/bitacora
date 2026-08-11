import type { BlockObjectResponse, RichTextItemResponse } from "@notionhq/client"
import { richTextToInline } from "./rich-text"
import type { TiptapNode } from "./tiptap-node"

// Árbol de bloques con hijos ya resueltos (fetch + paginación) y, si el bloque es una imagen, su
// URL ya reescrita a Supabase Storage (ver images.ts) — blocksToTiptap es puro, sin I/O.
export type ResolvedBlock = BlockObjectResponse & { children: ResolvedBlock[] }

function extractRichText(b: ResolvedBlock): RichTextItemResponse[] | null {
  const payload = (b as unknown as Record<string, unknown>)[b.type]
  if (payload && typeof payload === "object" && "rich_text" in payload) {
    return (payload as { rich_text: RichTextItemResponse[] }).rich_text
  }
  return null
}

// Un code block es texto plano: los marks de Notion (bold, code, links) no aplican adentro.
function codeText(items: RichTextItemResponse[]): TiptapNode[] {
  const text = items.map((i) => i.plain_text).join("")
  return text ? [{ type: "text", text }] : []
}

function listItemNode(b: ResolvedBlock): TiptapNode {
  const richText =
    b.type === "bulleted_list_item"
      ? b.bulleted_list_item.rich_text
      : b.type === "numbered_list_item"
        ? b.numbered_list_item.rich_text
        : []
  return {
    type: "listItem",
    content: [
      { type: "paragraph", content: richTextToInline(richText) },
      ...blocksToTiptap(b.children),
    ],
  }
}

// Bloques Notion-only sin equivalente (callouts, toggles, tablas, embeds, to_do...): si traen
// rich_text se preserva como paragraph (mejor texto legible que perder contenido), si no se
// descartan. Best-effort — spec: no se sobre-invierte por tipos no vistos en datos reales.
function blockToNode(b: ResolvedBlock): TiptapNode | null {
  switch (b.type) {
    case "paragraph":
      return { type: "paragraph", content: richTextToInline(b.paragraph.rich_text) }
    case "heading_1":
      return {
        type: "heading",
        attrs: { level: 1 },
        content: richTextToInline(b.heading_1.rich_text),
      }
    case "heading_2":
      return {
        type: "heading",
        attrs: { level: 2 },
        content: richTextToInline(b.heading_2.rich_text),
      }
    case "heading_3":
      return {
        type: "heading",
        attrs: { level: 3 },
        content: richTextToInline(b.heading_3.rich_text),
      }
    case "heading_4":
      return {
        type: "heading",
        attrs: { level: 4 },
        content: richTextToInline(b.heading_4.rich_text),
      }
    case "code":
      return {
        type: "codeBlock",
        attrs: { language: b.code.language },
        // Texto crudo con \n, no richTextToInline: ahí los saltos salen como nodos hardBreak, que
        // el schema de codeBlock (text*) no admite y que corren el syntax highlighting — el
        // hardBreak ocupa una posición en el doc pero no aporta caracteres a textContent, que es
        // lo que lowlight tokeniza, así que los colores se desfasan 1 char por línea.
        content: codeText(b.code.rich_text),
      }
    case "quote":
      return {
        type: "blockquote",
        content: [
          { type: "paragraph", content: richTextToInline(b.quote.rich_text) },
          ...blocksToTiptap(b.children),
        ],
      }
    case "divider":
      return { type: "horizontalRule" }
    case "image": {
      const src = b.image.type === "external" ? b.image.external.url : b.image.file.url
      return { type: "image", attrs: { src } }
    }
    default:
      return null
  }
}

export function blocksToTiptap(blocks: ResolvedBlock[]): TiptapNode[] {
  const result: TiptapNode[] = []
  let i = 0
  while (i < blocks.length) {
    const type = blocks[i].type
    if (type === "bulleted_list_item" || type === "numbered_list_item") {
      const items: TiptapNode[] = []
      while (i < blocks.length && blocks[i].type === type) items.push(listItemNode(blocks[i++]))
      result.push({
        type: type === "bulleted_list_item" ? "bulletList" : "orderedList",
        content: items,
      })
      continue
    }
    const block = blocks[i]
    const node = blockToNode(block)
    if (node) {
      result.push(node)
    } else {
      // Bloque sin equivalente (callout, toggle, columnas, tabla...): se aplana. Su rich_text
      // pasa como paragraph y sus hijos se convierten al mismo nivel — se pierde la envoltura
      // visual, no el contenido. Descartarlos en silencio perdía notas enteras.
      const richText = extractRichText(block)
      if (richText?.length) result.push({ type: "paragraph", content: richTextToInline(richText) })
      result.push(...blocksToTiptap(block.children))
    }
    i++
  }
  return result
}
