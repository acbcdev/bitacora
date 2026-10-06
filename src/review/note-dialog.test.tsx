import { act, fireEvent, render, screen } from "@testing-library/react"
import { NoteDialog } from "@/review/note-dialog"
import { note } from "@/test/harness"

// El autosave debounced es la lógica a probar; el store real no hace falta.
const mutate = vi.fn()
vi.mock("@/notes/notes.api", () => ({ useUpdateNote: () => ({ mutate }) }))
// Falso editor: el click dispara onChange con un doc "editado".
vi.mock("@/core/components/editor", () => ({
  Editor: ({ onChange }: { onChange?: (d: unknown) => void }) => (
    <button onClick={() => onChange?.({ type: "doc" })}>escribir</button>
  ),
}))
vi.mock("@/notes/note-actions", () => ({ NoteActions: () => null }))

const notebook = { id: "c1", name: "Notebook" } as never

function setup(id: string) {
  return render(
    <NoteDialog
      note={note({ id, title: "Nota", content: { type: "doc" } })}
      notebook={notebook}
      open
      marked={false}
      reads={0}
      onOpenChange={() => {}}
      onMarkRead={() => {}}
      onExpand={() => {}}
      onDeleted={() => {}}
    />,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  mutate.mockClear()
})
afterEach(() => vi.useRealTimers())

test("autosave debounced: guarda 800ms después de escribir", async () => {
  setup("n1")
  fireEvent.click(screen.getByText("escribir"))
  expect(mutate).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(800))
  expect(mutate).toHaveBeenCalledWith({ id: "n1", title: "Nota", content: { type: "doc" } })
})

test("al cambiar de nota guarda lo pendiente con el id de la nota tipeada", async () => {
  const { rerender } = setup("n1")
  fireEvent.click(screen.getByText("escribir"))
  rerender(
    <NoteDialog
      note={note({ id: "n2", title: "Otra", content: { type: "doc" } })}
      notebook={notebook}
      open
      marked={false}
      reads={0}
      onOpenChange={() => {}}
      onMarkRead={() => {}}
      onExpand={() => {}}
      onDeleted={() => {}}
    />,
  )
  expect(mutate).toHaveBeenCalledWith({ id: "n1", title: "Nota", content: { type: "doc" } })
  // Y no duplica: el timer quedó cancelado.
  await act(() => vi.advanceTimersByTimeAsync(800))
  expect(mutate).toHaveBeenCalledTimes(1)
})
