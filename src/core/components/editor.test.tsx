import { fireEvent, render, waitFor } from "@testing-library/react"
import { Editor } from "@/core/components/editor"
import type { TiptapDoc } from "@/core/types/database"

const doc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hola" }] }],
} as TiptapDoc

test("doble Esc saca el foco del editor, uno solo no", async () => {
  const { container } = render(<Editor content={doc} />)
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  pm.focus()

  fireEvent.keyDown(pm, { key: "Escape" })
  expect(document.activeElement).toBe(pm)

  fireEvent.keyDown(pm, { key: "Escape" })
  expect(document.activeElement).not.toBe(pm)
})
