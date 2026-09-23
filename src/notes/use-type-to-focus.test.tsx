import { fireEvent, render, waitFor } from "@testing-library/react"
import { useRef } from "react"
import { Editor } from "@/core/components/editor"
import type { EditorHandle } from "@/core/components/editor"
import { useTypeToFocus } from "@/notes/use-type-to-focus"
import type { TiptapDoc } from "@/core/types/database"

// Regla v2 (ADR 0017): la letra con el editor desenfocado enfoca y escribe; con mod, no.
// jsdom no simula la inserción de texto del browser (el default action del keydown), así que
// el "y la letra entra" se replica como llega en el navegador: un keydown al editor, ya
// enfocado, que PM atiende con su camino normal de tipeo (keydown + mutación DOM).

const doc = { type: "doc", content: [{ type: "paragraph" }] } as TiptapDoc

function Host() {
  const ref = useRef<EditorHandle>(null)
  useTypeToFocus(ref)
  return <Editor ref={ref} content={doc} />
}

async function renderHost() {
  const screen = render(<Host />)
  const pm = await waitFor(() => screen.container.querySelector<HTMLElement>(".ProseMirror")!)
  // jsdom no tiene layout: PM pide rects de text nodes al scrollear tras enfocar/insertar.
  Object.defineProperty(Range.prototype, "getClientRects", {
    value() {
      return [] as DOMRect[]
    },
    configurable: true,
  })
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    value() {
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect
    },
    configurable: true,
  })
  return { screen, pm }
}

test("letra con el editor desenfocado: enfoca el editor y la letra entra", async () => {
  const { pm } = await renderHost()

  // Foco en el body (no en un editable): el caso exacto de "entro a la pantalla y tipeo".
  fireEvent.keyDown(document.body, { key: "h" })
  // El focus de Tiptap corre dentro de un rAF: jsdom no corre rAF, esperar el tick.
  await waitFor(() => expect(document.activeElement).toBe(pm))

  // El navegador sigue insertando la letra en el editor ahora enfocado (default action →
  // mutación del DOM, que PM sincroniza). Replicar ese par event+mutación:
  pm.querySelector("p")!.appendChild(document.createTextNode("h"))
  await waitFor(() => expect(pm.textContent).toBe("h"))
})

test("mayúscula (shift) también enfoca", async () => {
  const { pm } = await renderHost()

  fireEvent.keyDown(document.body, { key: "H", shiftKey: true })
  await waitFor(() => expect(document.activeElement).toBe(pm))
})

test("mod+letra no enfoca: tiene su propio atajo asignado", async () => {
  const { pm } = await renderHost()

  fireEvent.keyDown(document.body, { key: "h", ctrlKey: true })

  expect(document.activeElement).not.toBe(pm)
})

test("teclas no-letra (Enter, flechas) no enfocan", async () => {
  const { pm } = await renderHost()

  fireEvent.keyDown(document.body, { key: "Enter" })
  fireEvent.keyDown(document.body, { key: "ArrowLeft" })

  expect(document.activeElement).not.toBe(pm)
})

test("foco en un input (título, buscador): la letra no roba el foco", async () => {
  const { pm } = await renderHost()
  const input = document.createElement("input")
  document.body.appendChild(input)
  input.focus()

  fireEvent.keyDown(document.body, { key: "h" })

  expect(document.activeElement).toBe(input)
  expect(pm.textContent).toBe("")
  input.remove()
})
