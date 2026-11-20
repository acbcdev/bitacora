import { expect, test } from "vitest"
import { docToMarkdown, markdownToDoc } from "@/core/lib/tiptap-markdown"
import type { TiptapDoc } from "@/core/types/database"

const doc = (...content: object[]) => ({ type: "doc", content }) as TiptapDoc
const src = "https://x.supabase.co/storage/v1/object/public/note-images/a%20b.png?t=1"

test("export: imagen con width lleva w= en el título", () => {
  const d = doc({ type: "image", attrs: { src, alt: "diagrama", width: 320 } })
  expect(docToMarkdown(d)).toBe(`![diagrama](${src} "w=320")`)
})

test("round-trip: imagen con y sin width, src intacto", () => {
  const d = doc(
    { type: "paragraph", content: [{ type: "text", text: "antes" }] },
    { type: "image", attrs: { src, alt: "a", width: 320 } },
    { type: "image", attrs: { src } },
    { type: "paragraph", content: [{ type: "text", text: "después" }] },
  )
  expect(markdownToDoc(docToMarkdown(d))).toEqual(d)
})

test("imagen sin width no inventa w=; height no se serializa", () => {
  const md = docToMarkdown(
    doc({ type: "image", attrs: { src, alt: null, width: null, height: 90 } }),
  )
  expect(md).toBe(`![](${src})`)
  expect(md).not.toContain("w=")
})

test("parse: imagen pegada a un párrafo lo corta", () => {
  expect(markdownToDoc(`hola\n![](${src})`).content).toEqual([
    { type: "paragraph", content: [{ type: "text", text: "hola" }] },
    { type: "image", attrs: { src } },
  ])
})
