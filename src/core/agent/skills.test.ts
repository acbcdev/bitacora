import { BUILTIN_SKILLS, effectiveSkills, matchSkill, skillNameError } from "@/core/agent/skills"
import type { SkillRow } from "@/core/types/database"

const row = (over: Partial<SkillRow>): SkillRow => ({
  id: "s1",
  user_id: "u",
  name: "x",
  description: "",
  prompt: "p",
  created_at: "2026-01-01T00:00:00Z",
  ...over,
})

test("sin filas, la lista efectiva son los built-ins", () => {
  expect(effectiveSkills([]).map((s) => s.name)).toEqual(BUILTIN_SKILLS.map((s) => s.name))
})

test("un override pisa al built-in en su lugar y un creado va al final", () => {
  const list = effectiveSkills([
    row({ id: "a", name: "resumir", prompt: "mío" }),
    row({ id: "b", name: "poema", prompt: "rimá" }),
  ])
  expect(list[0]).toMatchObject({ name: "resumir", prompt: "mío", builtin: true, id: "a" })
  expect(list.at(-1)).toMatchObject({ name: "poema", builtin: false, id: "b" })
  expect(list).toHaveLength(BUILTIN_SKILLS.length + 1)
})

test("matchSkill separa nombre y argumentos; un /foo inexistente no matchea", () => {
  const skills = effectiveSkills([])
  expect(matchSkill("/resumir esta nota", skills)).toMatchObject({
    skill: { name: "resumir" },
    args: "esta nota",
  })
  expect(matchSkill("/resumir", skills)?.args).toBe("")
  expect(matchSkill("/foo bar", skills)).toBeNull()
  expect(matchSkill("hola /resumir", skills)).toBeNull()
})

test("skillNameError valida slug y unicidad", () => {
  expect(skillNameError("", [])).toBeTruthy()
  expect(skillNameError("Mi Skill", [])).toBeTruthy()
  expect(skillNameError("resumir", ["resumir"])).toBeTruthy()
  expect(skillNameError("mi-skill-2", ["resumir"])).toBeNull()
})
