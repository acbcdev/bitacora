import type { TiptapDoc } from "@/types/database"

// Serializa un documento Tiptap (JSON de StarterKit) a Markdown.
// ponytail: cubre solo los nodos que el editor habilita (StarterKit). Nodo nuevo en el editor
// (tabla, imagen) = agregar su caso acá. No es un serializador ProseMirror completo a propósito.

type Node = {
  type: string
  content?: Node[]
  text?: string
  marks?: { type: string }[]
  attrs?: Record<string, unknown>
}

function inline(nodes: Node[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "\n"
      let t = n.text ?? ""
      for (const m of n.marks ?? []) {
        if (m.type === "bold") t = `**${t}**`
        else if (m.type === "italic") t = `*${t}*`
        else if (m.type === "code") t = `\`${t}\``
        else if (m.type === "strike") t = `~~${t}~~`
      }
      return t
    })
    .join("")
}

function list(node: Node, ordered: boolean): string {
  return (node.content ?? [])
    .map((item, i) => {
      const marker = ordered ? `${i + 1}. ` : "- "
      // Un listItem contiene bloques (normalmente un paragraph). Indento las líneas siguientes.
      const body = blocks(item.content ?? []).replace(/\n/g, "\n" + " ".repeat(marker.length))
      return marker + body
    })
    .join("\n")
}

function block(node: Node): string {
  switch (node.type) {
    case "paragraph":
      return inline(node.content)
    case "heading":
      return "#".repeat(Number(node.attrs?.level ?? 1)) + " " + inline(node.content)
    case "bulletList":
      return list(node, false)
    case "orderedList":
      return list(node, true)
    case "codeBlock":
      return "```" + String(node.attrs?.language ?? "") + "\n" + inline(node.content) + "\n```"
    case "blockquote":
      return blocks(node.content ?? [])
        .split("\n")
        .map((l) => "> " + l)
        .join("\n")
    case "horizontalRule":
      return "---"
    default:
      return inline(node.content) // fallback: nodo desconocido → su texto
  }
}

function blocks(nodes: Node[]): string {
  return nodes.map(block).join("\n\n")
}

export function docToMarkdown(doc: TiptapDoc): string {
  return blocks((doc.content as Node[]) ?? [])
}

// Descarga cliente-side pura (notes/03). Sin pantalla ni tabla nueva.
export function downloadMarkdown(title: string, doc: TiptapDoc) {
  const name = (title.trim() || "nota").replace(/[^\w\-]+/g, "-")
  const blob = new Blob([docToMarkdown(doc)], { type: "text/markdown" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${name}.md`
  a.click()
  URL.revokeObjectURL(url)
}
