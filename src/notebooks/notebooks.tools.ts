import { asData } from "@/core/agent/prompt"
import type { AgentTool } from "@/core/agent/tool"
import { notebooksPage, readStats } from "@/core/store/derive"
import { dayKey } from "@/core/lib/day"

// Tools del Agente de este módulo (ADR 0027): lógica de dominio, no CRUD sobre el Store.
// Las lecturas salen de `derive.ts` sobre el snapshot de la `AgentView`.
export const notebooksTools: AgentTool[] = [
  {
    name: "get_overview",
    description:
      "Panorama de la app: todos los notebooks (id, nombre, estado, área, cantidad de notas, último repaso), cantidad de hábitos y repasos de hoy. Empezá por acá para ubicarte.",
    schema: { type: "object", properties: {}, additionalProperties: false },
    risk: "read",
    async run(_args, { view, now }) {
      const snap = await view.snapshot()
      const { rows } = notebooksPage(snap, {
        q: "",
        status: "todos",
        sort: "recientes",
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
      })
      const orphans = snap.notes.filter((n) => n.kind === "note" && !n.notebook_id).length
      const lines = rows.map((n) =>
        asData("notebook", {
          id: n.id,
          nombre: n.name,
          estado: n.status,
          area: n.area,
          fuente: n.source,
          notas: n.notes,
          ultimo_repaso: n.last_read ? dayKey(new Date(n.last_read)) : null,
        }),
      )
      return [
        `Notebooks: ${rows.length}. Notas sin notebook: ${orphans}. Hábitos: ${snap.habits.length}. Repasos hoy: ${readStats(snap, now).today}.`,
        ...lines,
      ].join("\n")
    },
  },
]
