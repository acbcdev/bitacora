import { fireEvent, render, screen } from "@testing-library/react"
import { NoteDialog } from "@/review/note-dialog"
import { note } from "@/test/harness"

// El autosave vive (y se testea) en notes.api.test; acá solo el contrato dialog↔hook.
const calls: string[] = []
const flush = vi.fn(() => calls.push("flush"))
const useNoteDraft = vi.fn((_id: string, _open: boolean) => ({
  title: "Nota",
  flush,
  getDoc: () => ({}),
}))
vi.mock("@/notes/notes.api", () => ({
  useNoteDraft: (id: string, open: boolean) => useNoteDraft(id, open),
}))
vi.mock("@/notes/note-body", () => ({ NoteBody: () => null }))
vi.mock("@/notes/note-actions", () => ({ NoteActions: () => null }))

test("guarda antes de avanzar y le pasa open al hook", () => {
  const onMarkRead = vi.fn(() => calls.push("markRead"))
  render(
    <NoteDialog
      note={note({ id: "n1" })}
      notebook={undefined}
      open
      marked={false}
      reads={0}
      onOpenChange={() => {}}
      onMarkRead={onMarkRead}
      onExpand={() => {}}
      onDeleted={() => {}}
    />,
  )
  expect(useNoteDraft).toHaveBeenCalledWith("n1", true)
  fireEvent.click(screen.getByText("Leído y siguiente"))
  expect(calls).toEqual(["flush", "markRead"])
})
