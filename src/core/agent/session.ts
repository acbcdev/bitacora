import type { Store } from "@/core/store/types"
import { applyProposal, type Proposal } from "@/core/agent/proposal"
import type { Op } from "@/core/agent/tool"

// Estado de la sesión del Agente: la pila LIFO ÚNICA de turnos aplicados (en memoria; recargar la
// pierde). Solo el último turno se puede deshacer, reaplicando su `before` por el mismo camino
// que aplicó (`store.save`). Aprobar a mano (`apply`) y los turnos auto-aplicados del ticket 06
// (`pushApplied`) entran a la misma pila.
type Applied = { ops: Op[]; undo: Op[] }

export type UndoResult =
  | { status: "undone" }
  | { status: "empty" }
  // El estado actual difiere del `after` del turno: el caller avisa y ofrece `undo({ force: true })`.
  | { status: "changed"; labels: string[] }

export type Session = {
  // Aplica la Propuesta (ya con las ediciones del usuario) y la apila.
  apply(proposal: Proposal): Promise<void>
  // Apila un turno que ya se aplicó por otro camino. `undo` = las Ops inversas de `applyProposal`.
  pushApplied(ops: Op[], undo: Op[]): void
  canUndo(): boolean
  // Algo se aplicó en la sesión (aunque no tenga inversa: las creaciones no se deshacen).
  hasApplied(): boolean
  // Etiquetas del turno que revertiría `undo()`.
  last(): string[]
  undo(opts?: { force?: boolean }): Promise<UndoResult>
  clear(): void
}

// Lo que quedó escrito por el turno: por fila, los `after` mezclados en orden.
function expectedRows(ops: Op[]) {
  const rows = new Map<string, Op>()
  for (const op of ops) {
    const a = op.after as Record<string, unknown>
    const key = op.entity === "habit_log" ? `${a.habit_id}|${a.day}` : `${op.entity}|${a.id}`
    const prev = rows.get(key)
    rows.set(key, prev ? { ...op, after: { ...prev.after, ...op.after } } : op)
  }
  return [...rows.values()]
}

async function currentRow(store: Store, op: Op): Promise<Record<string, unknown> | undefined> {
  const a = op.after as Record<string, unknown>
  if (op.entity === "notes") return store.note(a.id as string).catch(() => undefined) as never
  const snap = await store.snapshot()
  if (op.entity === "notebooks") return snap.notebooks.find((r) => r.id === a.id)
  if (op.entity === "habits") return snap.habits.find((r) => r.id === a.id)
  if (op.entity === "habit_log")
    return snap.habitLog.find((r) => r.habit_id === a.habit_id && r.day === a.day)
  return undefined
}

async function changedSince(store: Store, ops: Op[]): Promise<string[]> {
  const changed: string[] = []
  for (const op of expectedRows(ops)) {
    const row = await currentRow(store, op)
    const same =
      row &&
      Object.entries(op.after).every(([k, v]) => JSON.stringify(row[k]) === JSON.stringify(v))
    if (!same) changed.push(op.label)
  }
  return changed
}

export function createSession(store: Store): Session {
  let stack: Applied[] = []
  let any = false

  const session: Session = {
    async apply(proposal) {
      // No atómico (known, ticket 03): si falla a mitad, lo ya aplicado queda sin apilar.
      const undo = await applyProposal(store, proposal)
      session.pushApplied(proposal.ops, undo)
    },
    pushApplied(ops, undo) {
      if (ops.length) any = true
      if (undo.length) stack.push({ ops, undo })
    },
    canUndo: () => stack.length > 0,
    hasApplied: () => any,
    last: () => stack.at(-1)?.ops.map((o) => o.label) ?? [],
    async undo({ force = false } = {}) {
      const top = stack.at(-1)
      if (!top) return { status: "empty" }
      if (!force) {
        // Solo las filas que el turno edita: las creaciones no se revierten ni se comparan.
        const labels = await changedSince(
          store,
          top.ops.filter((o) => o.before !== null),
        )
        if (labels.length) return { status: "changed", labels }
      }
      await applyProposal(store, { ops: top.undo })
      stack.pop()
      return { status: "undone" }
    },
    clear() {
      stack = []
      any = false
    },
  }
  return session
}
