import type { Note } from "@/core/types/database"
import type { Snapshot, Writable, WriteInput } from "@/core/store/types"

// La ÚNICA ventana de datos del Agente. Las tools leen por acá y nunca tocan `Store` directo:
// es el overlay de Borradores (`drafts.ts`) — las lecturas del turno ven lo ya propuesto.
export type AgentView = {
  snapshot(): Promise<Snapshot>
  note(id: string): Promise<Note>
}

export type ToolContext = { view: AgentView; now: Date }

// Una operación propuesta, lista para `store.save`. `before` = los mismos campos que toca `after`
// con su valor previo (null = creación). Deshacer = re-aplicar `before` (ticket 09), sin que el
// núcleo sepa de la tool que la produjo.
export type Op<E extends Writable = Writable> = {
  entity: E
  // Una línea para la card ("Crear nota «X»"); también es lo que el modelo lee como resultado.
  label: string
  before: WriteInput[E] | null
  after: WriteInput[E]
}

// `read` nunca pide aprobación. `safe` = aditiva (crear, loguear); `unsafe` = pisa algo existente.
// El nivel de aprobación (ticket 06) decide con esto; hoy todo escribe vía Propuesta.
export type ToolRisk = "read" | "safe" | "unsafe"

type ToolBase = {
  name: string
  description: string
  // JSON Schema plano (se envuelve con `jsonSchema()`, sin zod).
  schema: Record<string, unknown>
}

// Un módulo de dominio exporta `AgentTool[]` (`<módulo>.tools.ts`); el núcleo no sabe de módulos.
// `run` devuelve texto ya envuelto como dato (`asData`): es lo que el modelo lee.
export type ReadTool<A = Record<string, unknown>> = ToolBase & {
  risk: "read"
  run(args: A, ctx: ToolContext): Promise<string>
}

// Una escritura no escribe: `plan` calcula la Op contra la vista con Borradores. Tira Error si los
// args no cuadran (id inexistente…): el modelo lo ve como resultado de la tool.
export type WriteTool<A = Record<string, unknown>> = ToolBase & {
  risk: "safe" | "unsafe"
  plan(args: A, ctx: ToolContext): Promise<Op>
}

export type AgentTool<A = Record<string, unknown>> = ReadTool<A> | WriteTool<A>
