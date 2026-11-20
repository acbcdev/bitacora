import type { Store } from "@/core/store/types"
import type { Op } from "@/core/agent/tool"

// La Propuesta de un turno: todo o nada. Aprobar aplica las Ops en orden vía `store.save`;
// descartar es no hacer nada (los Borradores nunca tocaron el Store).
export type Proposal = { ops: Op[] }

// Devuelve las Ops inversas listas para deshacer (ticket 09): las ediciones reaplican `before`.
// Las creaciones no tienen inversa (sin delete, ADR 0027) y quedan fuera.
export async function applyProposal(store: Store, proposal: Proposal): Promise<Op[]> {
  const undo: Op[] = []
  for (const op of proposal.ops) {
    await store.save(op.entity, op.after as never, {
      create: op.before === null,
    })
    if (op.before)
      undo.unshift({
        ...op,
        label: `Deshacer: ${op.label}`,
        before: op.after,
        after: op.before,
      })
  }
  return undo
}
