import { findSlash } from "@/agent/slash-menu"

test("`/` solo abre el menú al inicio del mensaje y antes del primer espacio", () => {
  expect(findSlash("/", 1)).toBe("")
  expect(findSlash("/res", 4)).toBe("res")
  expect(findSlash("/resumir ", 9)).toBeNull()
  expect(findSlash("hola /res", 9)).toBeNull()
})
