import { mkdirSync, writeFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

// One-off: los code blocks importados de Notion guardaban los saltos de línea como nodos
// hardBreak (ver scripts/notion-import/rich-text.ts). El schema de codeBlock es `text*`, así que
// eso es contenido inválido, y además rompe el syntax highlighting: el hardBreak ocupa una
// posición en el doc pero no aporta caracteres a textContent — que es lo que lowlight tokeniza —
// así que los colores se corren 1 char por cada línea previa.
//
//   antes:  content: [text "a", hardBreak, text "b"]
//   después: content: [text "a\nb"]
//
// Dry-run por defecto. Para escribir de verdad: pnpm tsx scripts/fix-code-block-hardbreaks.ts --write

type Node = { type: string; text?: string; content?: Node[]; attrs?: unknown; marks?: unknown }

// Devuelve el nodo normalizado, o el mismo objeto si no hubo nada que tocar (así el caller sabe
// por identidad si la nota cambió, sin comparar JSON entero).
function fixNode(node: Node): Node {
  if (node.type === "codeBlock" && node.content?.some((c) => c.type === "hardBreak")) {
    const text = node.content.map((c) => (c.type === "hardBreak" ? "\n" : (c.text ?? ""))).join("")
    return { ...node, content: text ? [{ type: "text", text }] : [] }
  }
  if (!node.content) return node
  const kids = node.content.map(fixNode)
  return kids.some((k, i) => k !== node.content![i]) ? { ...node, content: kids } : node
}

process.loadEnvFile(".env")

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error("Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")

const write = process.argv.includes("--write")
const db = createClient(url, key)

const { data: notes, error } = await db.from("notes").select("id, content")
if (error) throw error

const changed = notes.flatMap((n) => {
  const fixed = fixNode(n.content as Node)
  return fixed === n.content ? [] : [{ id: n.id as string, content: fixed }]
})

console.log(`${notes.length} notas leídas — ${changed.length} con code blocks a arreglar`)

if (!write) {
  console.log("DRY RUN. Nada escrito. Corré con --write para aplicar.")
  process.exit(0)
}

// Backup del contenido original de las notas que se van a tocar: el update es masivo y no hay
// forma de volver atrás sin esto.
const backup = `.out/notes-backup-${Date.now()}.json`
mkdirSync(".out", { recursive: true })
const ids = new Set(changed.map((c) => c.id))
writeFileSync(backup, JSON.stringify(notes.filter((n) => ids.has(n.id as string)), null, 2))
console.log(`Backup de ${ids.size} notas en ${backup}`)

for (const { id, content } of changed) {
  const { error: upErr } = await db.from("notes").update({ content }).eq("id", id)
  if (upErr) throw new Error(`nota ${id}: ${upErr.message}`)
}
console.log(`Listo: ${changed.length} notas actualizadas.`)
