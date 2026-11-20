import type { Note } from "@/core/types/database"
import type { NoteRef, Snapshot, Store } from "@/core/store/types"
import type { AgentView, Op } from "@/core/agent/tool"

// Borradores: las Ops propuestas en el turno, como overlay en memoria sobre el Store. Lo que el
// modelo lee ya las incluye (crear un notebook y luego notas adentro); el Store no se toca hasta
// aprobar. Descartar = tirar el objeto.
export type Drafts = { view: AgentView; add(op: Op): void; ops(): Op[] }

const EPOCH = new Date(0).toISOString()

function applyToSnapshot(snap: Snapshot, op: Op): Snapshot {
  const a = op.after as Record<string, unknown>
  const creating = op.before === null
  // Alta agrega la fila (con defaults); edición mezcla `after` sobre la existente.
  const merge = <T extends { id: string }>(rows: T[], make: () => T): T[] =>
    creating ? [...rows, make()] : rows.map((r) => (r.id === a.id ? { ...r, ...a } : r))

  switch (op.entity) {
    case "notebooks":
      return {
        ...snap,
        notebooks: merge(
          snap.notebooks,
          () =>
            ({
              status: "active",
              started_at: null,
              finished_at: null,
              icon: null,
              source: null,
              area: null,
              imported: false,
              user_id: "",
              deleted_at: null,
              created_at: EPOCH,
              ...a,
            }) as Snapshot["notebooks"][number],
        ),
      }
    case "notes": {
      // El snapshot lleva NoteRef (sin content): el cuerpo vive en `view.note()`.
      const { content: _content, ...ref } = a
      return {
        ...snap,
        notes: merge(
          snap.notes,
          () =>
            ({
              notebook_id: null,
              title: "",
              kind: "note",
              position: 0,
              created_at: EPOCH,
              updated_at: EPOCH,
              ...ref,
            }) as NoteRef,
        ),
      }
    }
    case "habits":
      return {
        ...snap,
        habits: merge(
          snap.habits,
          () =>
            ({
              icon: null,
              kind: "good",
              metric: "check",
              target: 1,
              period: "day",
              days: null,
              tracks: null,
              user_id: "",
              deleted_at: null,
              created_at: EPOCH,
              ...a,
            }) as Snapshot["habits"][number],
        ),
      }
    case "habit_log": {
      const row = a as Snapshot["habitLog"][number]
      const rest = snap.habitLog.filter((r) => !(r.habit_id === row.habit_id && r.day === row.day))
      return { ...snap, habitLog: [...rest, row] }
    }
    default:
      return snap
  }
}

export function createDrafts(store: Store): Drafts {
  const ops: Op[] = []
  const view: AgentView = {
    async snapshot() {
      return ops.reduce(applyToSnapshot, await store.snapshot())
    },
    async note(id) {
      const mine = ops.filter((o) => o.entity === "notes" && (o.after as { id?: string }).id === id)
      let note: Note
      if (mine[0]?.before === null) {
        // Nota creada en este turno: no existe en el Store, se arma desde su Op de alta.
        note = {
          user_id: "",
          imported: false,
          deleted_at: null,
          content: { type: "doc", content: [] },
          kind: "note",
          ...(mine[0].after as object),
        } as unknown as Note
      } else {
        note = await store.note(id)
      }
      for (const o of mine) note = { ...note, ...(o.after as object) }
      return note
    },
  }
  return { view, add: (op) => ops.push(op), ops: () => ops.slice() }
}
