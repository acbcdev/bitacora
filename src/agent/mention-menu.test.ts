import { findMention } from "@/agent/mention-menu"
import { addPicked } from "@/agent/attach-menu"

test("@ al inicio o tras espacio abre el menú con la búsqueda hasta el caret", () => {
  expect(findMention("@", 1)).toEqual({ query: "", start: 0 })
  expect(findMention("resumí @tes", 11)).toEqual({ query: "tes", start: 7 })
})

test("un @ pegado a una palabra (mail) no es mención", () => {
  expect(findMention("a@b.com", 7)).toBeNull()
})

test("pasado un espacio la mención ya terminó", () => {
  expect(findMention("@nota hola", 10)).toBeNull()
})

test("addPicked no duplica el mismo adjunto", () => {
  const p = {
    label: "Todos los hábitos",
    attachment: { kind: "text" as const, tag: "habitos", attrs: {}, body: "x" },
  }
  expect(addPicked(addPicked([], p), { ...p })).toHaveLength(1)
})
