import { asData } from "@/core/agent/prompt"
import type { AgentTool } from "@/core/agent/tool"
import { frozenTarget, habitState } from "@/core/store/derive"
import { dayKey } from "@/core/lib/day"
import type { HabitInput } from "@/core/store/types"

const fields = {
  kind: {
    enum: ["good", "bad"],
    description: "good = piso (llegar a la meta), bad = techo",
  },
  metric: { enum: ["check", "count", "time"], description: "time en segundos" },
  target: { type: "number" },
  period: { enum: ["day", "week", "month"] },
}
const pick = (args: Record<string, unknown>): HabitInput =>
  Object.fromEntries(
    ["name", "kind", "metric", "target", "period"]
      .filter((k) => args[k] !== undefined)
      .map((k) => [k, args[k]]),
  )

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
  {
    name: "create_habit",
    description: "Propone crear un hábito. Devuelve su id.",
    schema: {
      type: "object",
      properties: { name: { type: "string" }, ...fields },
      required: ["name"],
      additionalProperties: false,
    },
    risk: "safe",
    async plan(args) {
      const after: HabitInput = { id: crypto.randomUUID(), ...pick(args) }
      return {
        entity: "habits",
        label: `Crear hábito «${after.name}» (id ${after.id})`,
        before: null,
        after,
      }
    },
  },
  {
    name: "update_habit",
    description: "Propone editar campos de un hábito (solo los que pasás).",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        ...fields,
      },
      required: ["id"],
      additionalProperties: false,
    },
    risk: "unsafe",
    async plan(args, { view }) {
      const h = (await view.snapshot()).habits.find((x) => x.id === args.id)
      if (!h) throw new Error(`No existe el hábito ${args.id}`)
      const after: HabitInput = { id: h.id, ...pick(args) }
      const before = Object.fromEntries(
        Object.keys(after).map((k) => [k, h[k as keyof typeof h]]),
      ) as HabitInput
      return {
        entity: "habits",
        label: `Editar hábito «${h.name}»`,
        before,
        after,
      }
    },
  },
  {
    name: "log_habit_day",
    description:
      "Propone registrar el avance de un hábito en un día: `amount` es el total del día (no un delta). Sin `day`, hoy (YYYY-MM-DD).",
    schema: {
      type: "object",
      properties: {
        habit_id: { type: "string" },
        amount: { type: "number" },
        day: { type: "string" },
      },
      required: ["habit_id", "amount"],
      additionalProperties: false,
    },
    risk: "safe",
    async plan(args, { view, now }) {
      const snap = await view.snapshot()
      const h = snap.habits.find((x) => x.id === args.habit_id)
      if (!h) throw new Error(`No existe el hábito ${args.habit_id}`)
      const day = (args.day as string | undefined) ?? dayKey(now)
      const prev = snap.habitLog.find((r) => r.habit_id === h.id && r.day === day)
      const after = {
        habit_id: h.id,
        day,
        amount: Math.max(0, args.amount as number),
        target: frozenTarget(snap.habitLog, h.id, day, h.target),
      }
      return {
        entity: "habit_log",
        label: `Registrar «${h.name}»: ${after.amount} el ${day}`,
        before: prev ? { ...prev } : null,
        after,
      }
    },
  },
]
