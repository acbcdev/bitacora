import { expect, test } from "vitest"
import { docToMarkdown, markdownToDoc } from "@/core/lib/tiptap-markdown"
import type { TiptapDoc } from "@/core/types/database"

const doc = (...content: object[]) => ({ type: "doc", content }) as TiptapDoc

const firstType = (md: string) => (markdownToDoc(md).content as { type: string }[])[0].type

test("round-trip: src con espacios y paréntesis no corrompe la imagen", () => {
  const d = doc({ type: "image", attrs: { src: "https://x.io/a b (1).png", alt: "a" } })
  const back = markdownToDoc(docToMarkdown(d)).content
  expect(back).toEqual([
    { type: "image", attrs: { src: "https://x.io/a%20b%20%281%29.png", alt: "a" } },
  ])
})

test("parse: esquemas no seguros no se vuelven imagen", () => {
  for (const bad of ["javascript:alert(1)", "vbscript:x", "data:text/html,x", "file:///etc/passwd"])
    expect(firstType(`![x](${bad})`)).toBe("paragraph")
  for (const ok of [
    "https://a.io/x.png",
    "http://a.io/x.png",
    "data:image/png;base64,AAA",
    "./x.png",
    "/x.png",
  ])
    expect(firstType(`![x](${ok})`)).toBe("image")
})
