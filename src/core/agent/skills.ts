import type { SkillRow } from "@/core/types/database"

// Skill (ADR 0028): instrucción con nombre que el usuario invoca con `/nombre`. Los built-ins
// viven acá; el Store guarda solo los overrides (misma `name`) y los creados.
export type Skill = { name: string; description: string; prompt: string }

// Un Skill de la lista efectiva. `id` = la fila del Store que lo respalda (override o creado);
// un built-in intacto no tiene fila.
export type EffectiveSkill = Skill & { builtin: boolean; id?: string }

export const BUILTIN_SKILLS: Skill[] = [
  {
    name: "resumir",
    description: "Una nota o notebook",
    prompt:
      "Resumí el contenido que te indico (adjunto o abierto) en pocos puntos claros. Conservá los datos concretos y no inventes nada que no esté ahí.",
  },
  {
    name: "explicar",
    description: "Explicame algo con simpleza",
    prompt:
      "Explicame el tema o el texto que te indico de forma simple, con un ejemplo corto. Si hay algo ambiguo, decime qué asumiste.",
  },
  {
    name: "habitos",
    description: "Feedback de cómo te va",
    prompt:
      "Hacé un review de mis hábitos: cómo me viene yendo con cada uno (rachas, constancia, qué mejoró o empeoró). Destacá lo que va bien, señalá dónde estoy flojo y dame un consejo concreto para la próxima semana. Sé honesto y breve.",
  },
  {
    name: "mejorar",
    description: "Mejorar el texto de una nota",
    prompt:
      "Mejorá el texto que te indico: corregí errores, hacelo más claro y fluido, y reescribí las partes confusas sin cambiar el sentido ni mi voz. Si hay cambios, proponelos como edición de la nota.",
  },
]

// Built-ins con el override aplicado (en su posición) + los creados por el usuario.
export function effectiveSkills(rows: SkillRow[]): EffectiveSkill[] {
  const byName = new Map(rows.map((r) => [r.name, r]))
  const builtinNames = new Set(BUILTIN_SKILLS.map((s) => s.name))
  const fromBuiltin = BUILTIN_SKILLS.map((b): EffectiveSkill => {
    const o = byName.get(b.name)
    return o
      ? { name: o.name, description: o.description, prompt: o.prompt, builtin: true, id: o.id }
      : { ...b, builtin: true }
  })
  const created = rows
    .filter((r) => !builtinNames.has(r.name))
    .map(
      (r): EffectiveSkill => ({
        name: r.name,
        description: r.description,
        prompt: r.prompt,
        builtin: false,
        id: r.id,
      }),
    )
  return [...fromBuiltin, ...created]
}

export const SKILL_NAME = /^[a-z0-9-]+$/
const SKILL_CALL = new RegExp(`^\\/(${SKILL_NAME.source.slice(1, -1)})(?:\\s+([\\s\\S]*))?$`)

// `/nombre args`. null = no empieza con `/skill` conocido → se envía como texto normal.
export function matchSkill(text: string, skills: Skill[]) {
  const m = SKILL_CALL.exec(text.trim())
  const skill = m && skills.find((s) => s.name === m[1])
  return skill ? { skill, args: (m[2] ?? "").trim() } : null
}

// Mensaje de error para el formulario, o null si el nombre sirve. `taken` = los demás nombres.
export function skillNameError(name: string, taken: string[]) {
  if (!name) return "Poné un nombre"
  if (!SKILL_NAME.test(name)) return "Solo minúsculas, números y guiones"
  if (taken.includes(name)) return "Ya existe un skill con ese nombre"
  return null
}
