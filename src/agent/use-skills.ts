import { useQuery } from "@tanstack/react-query"
import { store } from "@/core/store"
import { effectiveSkills, type EffectiveSkill } from "@/core/agent/skills"

export const SKILLS_KEY = ["skills"]

// La lista efectiva (built-ins con overrides + creados). Mientras carga, los built-ins: el menú
// `/` y el estado vacío nunca quedan vacíos. Una sola fuente para ambos y para el envío.
export function useSkills(): EffectiveSkill[] {
  const { data } = useQuery({
    queryKey: SKILLS_KEY,
    queryFn: async () => effectiveSkills(await store.skills.list()),
  })
  return data ?? effectiveSkills([])
}
