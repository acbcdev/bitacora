import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useNoteDraft } from "@/notes/notes.api"
import { store } from "@/core/store"
import { note } from "@/test/harness"

vi.mock("@/core/store", () => ({
  store: { note: vi.fn(), save: vi.fn(async () => ({})), snapshot: vi.fn(async () => ({})) },
}))

const notes = { n1: note({ id: "n1", title: "Uno" }), n2: note({ id: "n2", title: "Dos" }) }
const doc = { type: "doc", content: [{ type: "paragraph" }] } as never

function setup(initial: { id: string; open?: boolean }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return renderHook(({ id, open }) => useNoteDraft(id, open), {
    wrapper,
    initialProps: { open: true, ...initial },
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(store.save).mockClear()
  vi.mocked(store.note).mockImplementation(async (id) => notes[id as "n1"])
})
afterEach(() => vi.useRealTimers())

const flushQueries = () => act(() => vi.advanceTimersByTimeAsync(10))

test("autosave debounced: guarda 800ms después de escribir", async () => {
  const { result } = setup({ id: "n1" })
  await flushQueries()
  act(() => result.current.onDocChange(doc))
  expect(store.save).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(800))
  expect(store.save).toHaveBeenCalledWith("notes", { id: "n1", title: "Uno", content: doc })
})

test("cambiar de id con tipeo pendiente guarda la nota SALIENTE y no duplica", async () => {
  const { result, rerender } = setup({ id: "n1" })
  await flushQueries()
  act(() => {
    result.current.onTitleChange("Uno editado")
    result.current.onDocChange(doc)
  })
  rerender({ id: "n2", open: true })
  await flushQueries()
  expect(store.save).toHaveBeenCalledWith("notes", {
    id: "n1",
    title: "Uno editado",
    content: doc,
  })
  await flushQueries()
  await act(() => vi.advanceTimersByTimeAsync(800))
  expect(store.save).toHaveBeenCalledTimes(1)
})

test("open true→false guarda lo pendiente", async () => {
  const { result, rerender } = setup({ id: "n1" })
  await flushQueries()
  act(() => result.current.onDocChange(doc))
  rerender({ id: "n1", open: false })
  await flushQueries()
  expect(store.save).toHaveBeenCalledWith("notes", { id: "n1", title: "Uno", content: doc })
})

test("flush sin nada pendiente no guarda", async () => {
  const { result } = setup({ id: "n1" })
  await flushQueries()
  act(() => result.current.flush())
  expect(store.save).not.toHaveBeenCalled()
})
