import { useState } from "react"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { useNoteDraft } from "@/notes/notes.api"
import { note, renderApp } from "@/test/harness"
import type { Snapshot } from "@/core/store/types"

// Una regla, una suite: el autosave de useNoteDraft sirve a la pantalla Nota y al dialog de Repaso.
function Probe({ id, open = true }: { id: string; open?: boolean }) {
  const d = useNoteDraft(id, open)
  if (!d.note) return null
  return <button onClick={() => d.onDocChange({ type: "doc" })}>escribir</button>
}

type Props = { id: string; open?: boolean }
// renderApp envuelve en providers; rerender los perdería, así que las props viven en state.
let setProps: (p: Props) => void
function Controller({ initial }: { initial: Props }) {
  const [props, set] = useState(initial)
  setProps = set
  return <Probe {...props} />
}

const seed = {
  notes: [note({ id: "n1", title: "Nota" }), note({ id: "n2", title: "Otra" })],
} as unknown as Partial<Snapshot>

async function setup(id: string, open = true) {
  const r = renderApp(<Controller initial={{ id, open }} />, seed)
  const click = async () => fireEvent.click(await screen.findByText("escribir"))
  await click()
  return { ...r, click, again: (p: Props) => act(() => setProps(p)) }
}

const content = async (store: { note(id: string): Promise<{ content: unknown }> }, id: string) =>
  (await store.note(id)).content

test("autosave debounced: guarda 800ms después de escribir", async () => {
  const { store, unmount } = await setup("n1")
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  try {
    // Re-escribe con timers falsos: el debounce se arma sobre el reloj controlado.
    fireEvent.click(screen.getByText("escribir"))
    await act(() => vi.advanceTimersByTimeAsync(799))
    expect(await content(store, "n1")).not.toEqual({ type: "doc" })
    await act(() => vi.advanceTimersByTimeAsync(1))
  } finally {
    vi.useRealTimers()
  }
  await waitFor(async () => expect(await content(store, "n1")).toEqual({ type: "doc" }))
  unmount()
})

test("al cambiar de nota guarda lo pendiente en la nota tipeada, no en la nueva", async () => {
  const { store, again } = await setup("n1")
  again({ id: "n2" })
  await waitFor(async () => expect(await content(store, "n1")).toEqual({ type: "doc" }))
  expect(await content(store, "n2")).not.toEqual({ type: "doc" })
})

test("cerrar (open=false) guarda lo pendiente", async () => {
  const { store, again } = await setup("n1")
  again({ id: "n1", open: false })
  await waitFor(async () => expect(await content(store, "n1")).toEqual({ type: "doc" }))
})

test("cerrar sin cambios nuevos no vuelve a guardar", async () => {
  const { store, again } = await setup("n2")
  again({ id: "n2", open: false })
  await waitFor(async () => expect(await content(store, "n2")).toEqual({ type: "doc" }))
  const saved = (await store.note("n2")).updated_at
  again({ id: "n2", open: true })
  again({ id: "n2", open: false })
  await act(() => new Promise((r) => setTimeout(r, 50)))
  expect((await store.note("n2")).updated_at).toBe(saved)
})
