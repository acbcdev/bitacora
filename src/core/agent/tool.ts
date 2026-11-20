import type { Note } from "@/core/types/database"
import type { Snapshot } from "@/core/store/types"

// La ÚNICA ventana de datos del Agente. Las tools leen por acá y nunca tocan `Store` directo:
// hoy es un passthrough al store; el ticket de escrituras la reemplaza por el overlay de
// Borradores (lecturas que ven lo propuesto en este turno) sin tocar ninguna tool de lectura.
export type AgentView = {
  snapshot(): Promise<Snapshot>
  note(id: string): Promise<Note>
}

export type ToolContext = { view: AgentView; now: Date }

// Riesgo declarado por la tool. `read` nunca pide aprobación. `safe`/`unsafe` (escrituras, con
// `plan(args, snapshot) → { before, after }`) entran con el ticket 03 como otra rama de la unión.
export type ToolRisk = "read"

// Un módulo de dominio exporta `AgentTool[]` (`<módulo>.tools.ts`); el núcleo no sabe de módulos.
// `schema` es JSON Schema plano (se envuelve con `jsonSchema()`, sin zod). `run` devuelve texto
// que ya viene envuelto como dato (`asData`) — es lo que el modelo lee.
export type AgentTool<A = Record<string, unknown>> = {
  name: string
  description: string
  schema: Record<string, unknown>
  risk: ToolRisk
  run(args: A, ctx: ToolContext): Promise<string>
}
