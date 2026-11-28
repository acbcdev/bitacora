import { Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details"
import { allBlocks, blockAround, dropSlots, moveBlock } from "@/core/components/block-touch-actions"

const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
})
const editors: Editor[] = []
// Se destruyen en afterEach: si no, el timer del DOMObserver de ProseMirror dispara tras el teardown de jsdom ("document is not defined").
afterEach(() => editors.splice(0).forEach((e) => e.destroy()))
const make = (content: object[]) => {
  const e = new Editor({
    extensions: [StarterKit, Details, DetailsSummary, DetailsContent],
    content: { type: "doc", content },
  })
  editors.push(e)
  return e
}
const order = (e: Editor) => e.getText({ blockSeparator: "" })
const block = (e: Editor, text: string) =>
  allBlocks(e.state.doc).find((b) => b.node.textContent === text)!

test("moveBlock reordena hacia abajo, hacia arriba, al final y ignora no-ops", () => {
  const e = make(["A", "B", "C", "D"].map(para))
  moveBlock(e, block(e, "A"), block(e, "D").pos) // A cae antes de D
  expect(order(e)).toBe("BCAD")
  moveBlock(e, block(e, "D"), 0) // D cae al principio
  expect(order(e)).toBe("DBCA")
  moveBlock(e, block(e, "D"), e.state.doc.content.size) // D cae al final
  expect(order(e)).toBe("BCAD")
  moveBlock(e, block(e, "C"), block(e, "C").pos) // no-op
  moveBlock(e, block(e, "C"), block(e, "A").pos) // no-op (queda en el mismo lugar)
  expect(order(e)).toBe("BCAD")
})

// Modelo Notion: el Desplegable es un bloque y cada bloque de su cuerpo es un sub-bloque; la
// lista no es bloque, sus ítems sí.
test("sub-bloques: el cuerpo de un Desplegable y los ítems de una lista se mueven solos", () => {
  const e = make([
    {
      type: "details",
      content: [
        { type: "detailsSummary", content: [{ type: "text", text: "T" }] },
        { type: "detailsContent", content: [para("a"), para("b")] },
      ],
    },
    {
      type: "bulletList",
      content: ["x", "y"].map((t) => ({
        type: "listItem",
        content: [para(t)],
      })),
    },
    para("Z"),
  ])
  const names = () => allBlocks(e.state.doc).map((b) => b.node.type.name)
  expect(names()).toEqual([
    "details",
    "paragraph",
    "paragraph",
    "listItem",
    "listItem",
    "paragraph",
  ])

  // Cursor en el título → el Desplegable entero; en el cuerpo → ese párrafo; en un ítem → el ítem.
  const around = (text: string, offset = 1) => {
    let pos = 0
    e.state.doc.descendants((n, p) => void (n.isText && n.text === text && (pos = p)))
    return blockAround(e.state.doc.resolve(pos + offset))!.node.type.name
  }
  expect([around("T"), around("b"), around("y")]).toEqual(["details", "paragraph", "listItem"])

  // Un párrafo no cae ENTRE ítems (la lista no lo acepta) pero sí antes/después de la lista.
  const slots = dropSlots(e, block(e, "Z")).map((s) => s.pos)
  const list = e.state.doc.child(0).nodeSize
  expect(slots).toContain(list) // antes de la lista
  expect(slots).not.toContain(block(e, "y").pos)

  moveBlock(e, block(e, "b"), e.state.doc.content.size) // sale del Desplegable
  expect(order(e)).toBe("TaxyZb")
  moveBlock(e, block(e, "Z"), block(e, "a").pos) // entra al Desplegable
  expect(order(e)).toBe("TZaxyb")
  expect(e.state.doc.child(0).lastChild!.childCount).toBe(2)
  moveBlock(e, block(e, "y"), block(e, "x").pos) // ítem sobre ítem
  expect(order(e)).toBe("TZayxb")
})
