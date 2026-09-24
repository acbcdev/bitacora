import { waitFor } from "@testing-library/react"
import { store } from "@/core/store"
import { SNAPSHOT_KEY, useSnapshot, useSnapshotMutation } from "@/core/lib/snapshot"
import type { Snapshot } from "@/core/store/types"
import type { Note } from "@/core/types/database"
import { note, notebook, renderApp } from "@/test/harness"

let mutate!: () => void

// Hecho derivado tonto: appendea un ref nuevo al snapshot. Suficiente para probar el seam sin
// conocer hábitos ni notas.
const appendRef = (snap: Snapshot | undefined): Snapshot | undefined =>
  snap && { ...snap, notes: [...snap.notes, { ...snap.notes[0]!, id: "nX" }] }

function SowProbe({ fail, slow }: { fail?: boolean; slow?: boolean }) {
  useSnapshot((s) => s.notes)
  const m = useSnapshotMutation(
    async () => {
      if (slow) await new Promise((r) => setTimeout(r, 200))
      if (fail) throw new Error("boom")
      return undefined
    },
    { sow: appendRef },
  )
  mutate = () => m.mutate(undefined)
  return null
}

function CreateProbe() {
  useSnapshot((s) => s.notes)
  const m = useSnapshotMutation(() =>
    store.save("notes", { notebook_id: "c1", position: 1, content: { type: "doc", content: [] } }),
  )
  mutate = () => m.mutate(undefined)
  return null
}

function BareProbe() {
  // Sin montar useSnapshot: el cache del snapshot está vacío.
  const m = useSnapshotMutation(async () => undefined, {
    sow: (snap) => {
      saw.push(snap)
      return undefined
    },
  })
  mutate = () => m.mutate(undefined)
  return null
}

const saw: (Snapshot | undefined)[] = []

const seed = { notebooks: [notebook({ id: "c1" })], notes: [note({ id: "n1", position: 0 })] }

test("sow siembra el hecho derivado en el instante del mutate, sin esperar el server", async () => {
  const { qc } = renderApp(<SowProbe slow />, seed)
  await waitFor(() => expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)).toBeTruthy())

  mutate()
  await waitFor(() =>
    expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.notes.map((r) => r.id)).toContain("nX"),
  )
})

test("si la mutation falla, el módulo revierte la siembra optimista", async () => {
  const { qc } = renderApp(<SowProbe fail />, seed)
  await waitFor(() => expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)).toBeTruthy())

  mutate()
  await waitFor(() =>
    expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.notes.map((r) => r.id)).not.toContain("nX"),
  )
  expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.notes.map((r) => r.id)).toContain("n1")
})

test("sow con cache vacío no siembra un snapshot vacío", async () => {
  renderApp(<BareProbe />)
  await mutate() // asegura que onMutate ya corrió
  expect(saw).toEqual([undefined])
})

test("la fila que el server devolvió se siembra en ['note', id] y en el snapshot (ADR 0008)", async () => {
  const { qc } = renderApp(<CreateProbe />, seed)
  await waitFor(() => expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)).toBeTruthy())

  mutate()
  await waitFor(() => expect(qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.notes).toHaveLength(2))
  const snap = qc.getQueryData<Snapshot>(SNAPSHOT_KEY)!
  const newRef = snap.notes.find((r) => r.id !== "n1")!
  // El position (+1) salió del snapshot en cache, no de un SELECT.
  expect(newRef.position).toBe(1)
  expect(newRef.notebook_id).toBe("c1")
  // La query dependiente queda sembrada con la fila completa.
  expect(qc.getQueryData<Note>(["note", newRef.id])).toMatchObject({ id: newRef.id })
})
