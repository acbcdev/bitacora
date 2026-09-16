export type Action = {
  group: string
  label: string
  icon?: React.ReactNode
  kbd?: string
  run: () => void
}

const MAX = 50 // tope de resultados al buscar
const PREVIEW = 5 // items por grupo cuando no hay query

// Filtro propio: cmdk monta y puntúa TODOS los items, y en cada tecla reordena el DOM item por
// item — con ~1.500 notas la palette tarda en abrir y va a tirones. Acá matcheamos por substring
// (todas las palabras del query) y cortamos, así nunca hay más de ~50 nodos en el DOM.
// ponytail: sin scoring ni ranking; si "los 50 primeros" deja fuera lo que buscás, ahí sí FTS.
export function filterActions(actions: Action[], q: string): Action[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)

  // Sin query: solo los últimos de cada grupo. Notas y notebooks vienen ordenados por `position`
  // ascendente y `position` se appendea al crear, así que el final = lo más nuevo.
  // Los grupos fijos (Navegar, Vista…) tienen ≤ PREVIEW items, así que salen enteros.
  if (!words.length) {
    const byGroup = new Map<string, Action[]>()
    for (const a of actions) byGroup.set(a.group, [...(byGroup.get(a.group) ?? []), a])
    return [...byGroup.values()].flatMap((items) => items.slice(-PREVIEW))
  }

  const hits: Action[] = []
  for (const a of actions) {
    const hay = `${a.group} ${a.label}`.toLowerCase()
    if (words.every((w) => hay.includes(w)) && hits.push(a) === MAX) break
  }
  return hits
}
