import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { NoteActions } from "@/notes/note-actions"
import type { Note, TiptapDoc } from "@/core/types/database"

const { softDelete } = vi.hoisted(() => ({ softDelete: vi.fn(() => Promise.resolve()) }))

// El test afirma la operación de dominio ("borrá esta nota"), no cómo se escribe el soft delete.
// Que `deleted_at` sea la forma de borrar es cosa del adapter, y ahí es donde se testea.
vi.mock("@/core/store", () => ({
  store: {
    softDelete,
    snapshot: async () => ({ courses: [], notes: [], reads: [], habits: [], habitLog: [] }),
  },
}))

const doc: TiptapDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hola" }] }],
}
const note = { id: "n1", title: "Mi nota", course_id: "c1", content: doc } as Note

function renderActions(props: Partial<React.ComponentProps<typeof NoteActions>> = {}) {
  const onDeleted = vi.fn()
  const onConfirmingChange = vi.fn()
  const onFocus = vi.fn()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <TooltipProvider>
          <NoteActions
            note={note}
            content={() => doc}
            confirming={false}
            onConfirmingChange={onConfirmingChange}
            onFocus={onFocus}
            onDeleted={onDeleted}
            {...props}
          />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onDeleted, onConfirmingChange, onFocus }
}

// Radix abre el menú con pointerdown; en jsdom es más estable por teclado (ver course.test.tsx).
function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Acciones de la nota" }), { key: "Enter" })
}

test("copiar manda el doc en vivo al clipboard", async () => {
  const writeText = vi.fn(() => Promise.resolve())
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
  renderActions()

  openMenu()
  // Anclado: "Copiar link" también matchea "Copiar".
  fireEvent.click(await screen.findByRole("menuitem", { name: /^Copiar$/ }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("hola"))
})

test("borrar nota pide confirmación y recién ahí hace el soft delete", async () => {
  const { onConfirmingChange } = renderActions()

  openMenu()
  fireEvent.click(await screen.findByRole("menuitem", { name: "Borrar nota" }))
  // El item solo pide abrir el confirm: no toca la DB.
  expect(onConfirmingChange).toHaveBeenCalledWith(true)
  expect(softDelete).not.toHaveBeenCalled()
})

test("confirmar borra la nota y avisa al call site", async () => {
  const { onDeleted } = renderActions({ confirming: true })

  fireEvent.click(await screen.findByRole("button", { name: "Borrar" }))
  await waitFor(() => expect(onDeleted).toHaveBeenCalled())
  expect(softDelete).toHaveBeenCalledWith("notes", "n1")
})
