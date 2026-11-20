import { localStore } from "@/core/store/local-store"
import { docToMarkdown, markdownToDoc } from "@/core/lib/tiptap-markdown"
import { createSession } from "@/core/agent/session"
import type { Op } from "@/core/agent/tool"

const store = localStore()
beforeEach(() => localStorage.clear())

const md = async (id: string) => docToMarkdown((await store.note(id)).content)

function editOp(id: string, from: string, to: string): Op {
  return {
    entity: "notes",
    label: "Editar «A»",
    before: { id, content: markdownToDoc(from) },
    after: { id, content: markdownToDoc(to) },
  }
}

test("undo es LIFO: cada deshacer revierte solo el último turno aplicado", async () => {
  const nota = await store.save("notes", { title: "A", position: 0, content: markdownToDoc("uno") })
  const session = createSession(store)
  await session.apply({ ops: [editOp(nota.id, "uno", "dos")] })
  await session.apply({ ops: [editOp(nota.id, "dos", "tres")] })
  expect(await md(nota.id)).toBe("tres")

  expect(await session.undo()).toEqual({ status: "undone" })
  expect(await md(nota.id)).toBe("dos")
  expect(await session.undo()).toEqual({ status: "undone" })
  expect(await md(nota.id)).toBe("uno")
  expect(session.canUndo()).toBe(false)
  expect(await session.undo()).toEqual({ status: "empty" })
})

test("si la nota cambió desde que se aplicó, bloquea; force = Deshacer igual", async () => {
  const nota = await store.save("notes", { title: "A", position: 0, content: markdownToDoc("uno") })
  const session = createSession(store)
  await session.apply({ ops: [editOp(nota.id, "uno", "dos")] })
  await store.save("notes", { id: nota.id, content: markdownToDoc("dos, editado a mano") })

  expect(await session.undo()).toMatchObject({ status: "changed" })
  expect(await md(nota.id)).toBe("dos, editado a mano")
  expect(session.canUndo()).toBe(true)

  expect(await session.undo({ force: true })).toEqual({ status: "undone" })
  expect(await md(nota.id)).toBe("uno")
})

test("pushApplied (turnos auto-aplicados) entra a la misma pila", async () => {
  const nota = await store.save("notes", { title: "A", position: 0, content: markdownToDoc("uno") })
  const session = createSession(store)
  const op = editOp(nota.id, "uno", "dos")
  await store.save("notes", op.after as never)
  session.pushApplied([op], [{ ...op, before: op.after, after: op.before! }])
  expect(await session.undo()).toEqual({ status: "undone" })
  expect(await md(nota.id)).toBe("uno")
})

test("clear vacía la pila; hasApplied cuenta hasta las creaciones (sin inversa)", async () => {
  const session = createSession(store)
  const create: Op = {
    entity: "notebooks",
    label: "Crear",
    before: null,
    after: { id: crypto.randomUUID(), name: "N" },
  }
  await session.apply({ ops: [create] })
  expect(session.canUndo()).toBe(false)
  expect(session.hasApplied()).toBe(true)
  session.clear()
  expect(session.hasApplied()).toBe(false)
})

test("una nota con imágenes reescrita conserva src y width", async () => {
  const body = 'texto\n\n![foto](https://x.test/a.png "w=320")'
  const nota = await store.save("notes", { title: "A", position: 0, content: markdownToDoc(body) })
  const session = createSession(store)
  const before = (await store.note(nota.id)).content
  const after = markdownToDoc(`${docToMarkdown(before)}\n\nfin`)
  await session.apply({
    ops: [
      {
        entity: "notes",
        label: "x",
        before: { id: nota.id, content: before },
        after: { id: nota.id, content: after },
      },
    ],
  })
  const img = (await store.note(nota.id)).content.content?.find(
    (n) => (n as { type: string }).type === "image",
  ) as { attrs: object } | undefined
  expect(img?.attrs).toMatchObject({ src: "https://x.test/a.png", width: 320 })
})
