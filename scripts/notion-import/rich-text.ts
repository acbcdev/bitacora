import type { RichTextItemResponse } from "@notionhq/client"
import type { TiptapMark, TiptapNode } from "./tiptap-node"

// Links a notion.so (o rutas relativas dentro del mismo workspace) apuntan a páginas Notion no
// migradas — se aplanan a texto plano (spec .scratch/notion-import). Todo lo demás es externo.
function isInternalNotionLink(href: string): boolean {
  return href.includes("notion.so") || href.startsWith("/")
}

function marksFor(item: RichTextItemResponse): TiptapMark[] {
  const marks: TiptapMark[] = []
  const a = item.annotations
  if (a.bold) marks.push({ type: "bold" })
  if (a.italic) marks.push({ type: "italic" })
  if (a.strikethrough) marks.push({ type: "strike" })
  if (a.underline) marks.push({ type: "underline" })
  if (a.code) marks.push({ type: "code" })

  const href = item.type === "text" ? item.text.link?.url : item.href
  if (href && !isInternalNotionLink(href)) marks.push({ type: "link", attrs: { href } })

  return marks
}

// Bloques de la API de Notion → Tiptap JSON directo (spec: no vía markdown). Cada rich_text item
// (mention/equation incluidos) se aplana a su plain_text — sin nodos Tiptap equivalentes a
// mentions/equations hoy, mejor texto legible que perder el contenido.
export function richTextToInline(items: RichTextItemResponse[]): TiptapNode[] {
  const nodes: TiptapNode[] = []
  for (const item of items) {
    if (!item.plain_text) continue
    const marks = marksFor(item)
    const lines = item.plain_text.split("\n")
    lines.forEach((line, i) => {
      if (i > 0) nodes.push({ type: "hardBreak" })
      if (line)
        nodes.push(
          marks.length ? { type: "text", text: line, marks } : { type: "text", text: line },
        )
    })
  }
  return nodes
}
