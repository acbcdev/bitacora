import { asData } from "@/core/agent/prompt"
import type { AgentTool } from "@/core/agent/tool"
import { habitState } from "@/core/store/derive"

export const habitsTools: AgentTool[] = [
  {
    name: "get_habits",
    description:
      "Lista los hábitos con su meta (target/período) y su estado actual: progreso de hoy, racha y si cumple.",
    schema: { type: "object", properties: {}, additionalProperties: false },
    risk: "read",
    async run(_args, { view, now }) {
      const snap = await view.snapshot()
      const lines = snap.habits.map((h) => {
        const s = habitState(snap, h.id, now)
        return asData("habito", {
          id: h.id,
          nombre: h.name,
          tipo: h.kind,
          metrica: h.metric,
          meta: h.target,
          periodo: h.period,
          hoy: s?.today ?? 0,
          racha: s?.streak ?? 0,
          cumple: s?.met ? "si" : "no",
        })
      })
      return [`Hábitos: ${lines.length}`, ...lines].join("\n")
    },
  },
]
