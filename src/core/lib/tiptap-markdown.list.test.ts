import { expect, test } from "vitest"
import { markdownToDoc } from "@/core/lib/tiptap-markdown"

test("repro lista numerada con líneas de continuación", () => {
  const md = [
    "1. **Media aritmética:**",
    "",
    "   120 + 150 + 130 = 400",
    "   400 / 3 = 133,3",
    "",
    "2. **Mediana:**",
    "",
    "   valor1 = 170, valor2 = 175",
  ].join("\n")
  const doc = markdownToDoc(md)
  // UNA sola lista, dos ítems — no `orderedList, paragraph, orderedList` (era el bug: la lista
  // se partía en la línea de continuación indentada y cada <ol> volvía a numerar desde 1).
  expect(doc.content).toHaveLength(1)
  const list = doc.content![0] as { type: string; content: unknown[] }
  expect(list.type).toBe("orderedList")
  expect(list.content).toHaveLength(2)
  const item = list.content[0] as { content: { type: string }[] }
  // título + las dos líneas de continuación indentadas, dentro del mismo listItem
  expect(item.content.map((n) => n.type)).toEqual(["paragraph", "paragraph", "paragraph"])
})
