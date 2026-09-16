import type { TiptapDoc } from "@/core/types/database"

// Serializa/parsea Markdown <-> documento Tiptap (JSON de StarterKit).
// ponytail: cubre solo los nodos que el editor habilita (StarterKit). Nodo nuevo en el editor
// (tabla, imagen) = agregar su caso en block()/parseBlocks(). No es CommonMark completo a propósito.

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
    case "table":
      return tableToMarkdown(node)
    default:
      return inline(node.content) // fallback: nodo desconocido → su texto
  }
}

function blocks(nodes: Node[]): string {
  return nodes.map(block).join("\n\n")
}

// Texto de una celda (sus bloques, normalmente un paragraph) en una sola línea.
function cellText(cell: Node): string {
  return (cell.content ?? [])
    .map((b) => (b.type === "paragraph" ? inline(b.content) : (b.text ?? "")))
    .filter(Boolean)
    .join(" ")
}

// Serializa a GFM. La primera fila siempre sale como header — es como entran las tablas por
// paste/import; una tabla sin header se pierde el matiz, no el contenido.
function tableToMarkdown(table: Node): string {
  const rows = (table.content ?? []).map((row) => (row.content ?? []).map(cellText))
  const cols = Math.max(...rows.map((r) => r.length), 1)
  const line = (cells: string[]) => `| ${cells.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`
  return [
    line(padRow(rows[0] ?? [], cols)),
    `| ${Array(cols).fill("---").join(" | ")} |`,
    ...rows.slice(1).map((r) => line(padRow(r, cols))),
  ].join("\n")
}

export function docToMarkdown(doc: TiptapDoc): string {
  return blocks((doc.content as Node[]) ?? [])
}

function plainInline(nodes: Node[] = []): string {
  return nodes.map((n) => n.text ?? "").join("")
}

// Extracto sin formato (review/note-dialog): a diferencia de blocks(), separa bloques con un
// espacio en vez de "\n\n" y no aplica marks — pensado para una sola línea truncada por CSS.
function plainBlock(node: Node): string {
  switch (node.type) {
    case "bulletList":
    case "orderedList":
      return (node.content ?? []).map((item) => plainBlocks(item.content ?? [])).join(" ")
    case "blockquote":
      return plainBlocks(node.content ?? [])
    // table/tableRow/tableHeader/tableCell se aplanan igual: cada nivel delega a plainBlocks.
    case "table":
    case "tableRow":
    case "tableHeader":
    case "tableCell":
      return plainBlocks(node.content ?? [])
    default:
      return plainInline(node.content)
  }
}

function plainBlocks(nodes: Node[]): string {
  return nodes.map(plainBlock).filter(Boolean).join(" ")
}

export function docToPlainText(doc: TiptapDoc): string {
  return plainBlocks((doc.content as Node[]) ?? [])
}

const INLINE_RE =
  /`([^`]+)`|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_/g

function parseInline(text: string): Node[] {
  const nodes: Node[] = []
  const pushText = (raw: string) => {
    raw.split("\n").forEach((line, i) => {
      if (i > 0) nodes.push({ type: "hardBreak" })
      if (line) nodes.push({ type: "text", text: line })
    })
  }

  let last = 0
  for (const m of text.matchAll(INLINE_RE)) {
    pushText(text.slice(last, m.index))
    if (m[1] !== undefined) nodes.push({ type: "text", text: m[1], marks: [{ type: "code" }] })
    else if (m[2] !== undefined)
      nodes.push({ type: "text", text: m[2], marks: [{ type: "bold" }, { type: "italic" }] })
    else if (m[3] !== undefined || m[4] !== undefined)
      nodes.push({ type: "text", text: (m[3] ?? m[4])!, marks: [{ type: "bold" }] })
    else if (m[5] !== undefined)
      nodes.push({ type: "text", text: m[5], marks: [{ type: "strike" }] })
    else if (m[6] !== undefined || m[7] !== undefined)
      nodes.push({ type: "text", text: (m[6] ?? m[7])!, marks: [{ type: "italic" }] })
    last = m.index + m[0].length
  }
  pushText(text.slice(last))
  return nodes
}

const FENCE_RE = /^```(.*)$/
const HEADING_RE = /^(#{1,6})\s+(.*)$/
const HR_RE = /^(-{3,}|\*{3,}|_{3,})\s*$/
const QUOTE_RE = /^>\s?/
const BULLET_RE = /^[-*]\s+/
const ORDERED_RE = /^\d+\.\s+/
const SPECIAL_LINE_RE = new RegExp(
  [FENCE_RE, HEADING_RE, HR_RE, QUOTE_RE, BULLET_RE, ORDERED_RE].map((r) => r.source).join("|"),
)

// Tabla GFM: fila de celdas con `|` seguida de una fila separadora (solo `-`, `:` y pipes).
const DELIM_RE = /^[\s:|-]+$/

function isDelimiter(line: string): boolean {
  return line.includes("-") && DELIM_RE.test(line)
}

// Parte una fila en celdas: respeta pipes escapados (`\|`) y trims los bordes.
function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith("|")) s = s.slice(1)
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1)
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replaceAll("\\|", "|"))
}

// Pad/trunca una fila al ancho de la tabla — la misma regla en parse y serialize (round-trip).
function padRow(cells: string[], cols: number): string[] {
  return Array.from({ length: cols }, (_, i) => cells[i] ?? "")
}

function tableRow(cells: string[], cols: number, header: boolean): Node {
  return {
    type: "tableRow",
    content: padRow(cells, cols).map((text) => ({
      type: header ? "tableHeader" : "tableCell",
      content: [{ type: "paragraph", content: parseInline(text) }],
    })),
  }
}

function parseTable(lines: string[], i: number): [Node, number] {
  const cols = splitRow(lines[i + 1]).length // el separador define el ancho
  const rows: Node[] = [tableRow(splitRow(lines[i]), cols, true)]
  i += 2 // header + separador
  // Como GFM: la tabla termina ante una línea en blanco o el arranque de otro bloque (heading,
  // lista, quote, fence...) aunque traiga un pipe.
  while (i < lines.length && lines[i].includes("|") && !SPECIAL_LINE_RE.test(lines[i]))
    rows.push(tableRow(splitRow(lines[i++]), cols, false))
  return [{ type: "table", content: rows }, i]
}

function listItems(lines: string[], start: number, itemRe: RegExp): [Node[], number] {
  const items: Node[] = []
  let i = start
  while (i < lines.length && itemRe.test(lines[i])) {
    const content = [{ type: "paragraph", content: parseInline(lines[i].replace(itemRe, "")) }]
    i++
    // Líneas de continuación indentadas (paste de ChatGPT/Claude: `1. ítem` + `   más texto`)
    // y los blanks intermedios entran al MISMO listItem — cortar acá partía la lista en un
    // <ol> por ítem y todos volvían a numerar desde 1.
    while (i < lines.length) {
      if (lines[i].trim() === "") {
        // Blank dentro de la lista: sólo se traga si sigue otra línea del mismo bloque
        // (ítem o continuación indentada). Si viene texto de otro nivel, corta la lista.
        const next = lines[i + 1]
        if (next === undefined || !(itemRe.test(next) || /^	| {2,}/.test(next))) break
        i++
        continue
      }
      if (itemRe.test(lines[i])) break
      if (!/^(	| {2,})/.test(lines[i])) break
      content.push({
        type: "paragraph",
        content: parseInline(lines[i].replace(/^(	| {2,})/, "")),
      })
      i++
    }
    items.push({ type: "listItem", content })
  }
  return [items, i]
}

// Parsea líneas de Markdown a bloques Tiptap. Contraparte de blocks()/block() arriba.
function parseBlocks(text: string): Node[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const result: Node[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === "") {
      i++
      continue
    }

    const fence = line.match(FENCE_RE)
    if (fence) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !FENCE_RE.test(lines[i])) codeLines.push(lines[i++])
      i++ // cierra ```
      result.push({
        type: "codeBlock",
        attrs: fence[1].trim() ? { language: fence[1].trim() } : {},
        content: codeLines.length ? [{ type: "text", text: codeLines.join("\n") }] : [],
      })
      continue
    }

    const heading = line.match(HEADING_RE)
    if (heading) {
      result.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: parseInline(heading[2]),
      })
      i++
      continue
    }

    if (HR_RE.test(line.trim())) {
      result.push({ type: "horizontalRule" })
      i++
      continue
    }

    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && QUOTE_RE.test(lines[i]))
        quoteLines.push(lines[i++].replace(QUOTE_RE, ""))
      result.push({ type: "blockquote", content: parseBlocks(quoteLines.join("\n")) })
      continue
    }

    if (BULLET_RE.test(line)) {
      const [items, next] = listItems(lines, i, BULLET_RE)
      result.push({ type: "bulletList", content: items })
      i = next
      continue
    }

    if (ORDERED_RE.test(line)) {
      const [items, next] = listItems(lines, i, ORDERED_RE)
      result.push({ type: "orderedList", content: items })
      i = next
      continue
    }

    // Tabla GFM: header con pipes + fila separadora con LA MISMA cantidad de celdas (sin el match
    // de ancho, "Resumen | notas" seguido de un --- de HR se comería el texto como tabla).
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isDelimiter(lines[i + 1]) &&
      splitRow(lines[i]).length === splitRow(lines[i + 1]).length
    ) {
      const [table, next] = parseTable(lines, i)
      result.push(table)
      i = next
      continue
    }

    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() !== "" && !SPECIAL_LINE_RE.test(lines[i])) {
      paraLines.push(lines[i++])
    }
    result.push({ type: "paragraph", content: parseInline(paraLines.join("\n")) })
  }

  return result
}

export function markdownToDoc(text: string): TiptapDoc {
  return { type: "doc", content: parseBlocks(text) }
}

// Descarga cliente-side pura (notes/03). Sin pantalla ni tabla nueva.
export function downloadMarkdown(title: string, doc: TiptapDoc) {
  const name = (title.trim() || "nota").replace(/[^\w-]+/g, "-")
  const blob = new Blob([docToMarkdown(doc)], { type: "text/markdown" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${name}.md`
  a.click()
  URL.revokeObjectURL(url)
}
