import type { Notebook } from "@/core/types/database"

// Cada notebook vive en un solo grupo: fijado gana sobre activo, activo sobre reciente — sin eso
// el mismo notebook aparecería duplicado en dos secciones.
// Vive acá afuera porque App usa el mismo orden para numerar el atajo G>1..9.
export function sidebarNotebookGroups(notebooks: Notebook[], pinnedIds: string[]) {
  const pinned = new Set(pinnedIds)
  return {
    pinned: notebooks.filter((c) => pinned.has(c.id)),
    active: notebooks.filter((c) => c.status === "active" && !pinned.has(c.id)),
    // Mismo criterio que el sort "Recientes" de /notebooks (started_at desc, ver migración 0009),
    // acá recortado a un puñado.
    recent: notebooks
      .filter((c) => c.status !== "active" && !pinned.has(c.id))
      .toSorted((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""))
      .slice(0, 5),
  }
}

// Qué notebook abre cada dígito del atajo G>1..9, con la regla de ⌘1..9 del browser: 1-8 son
// posición en el sidebar y 9 es siempre el último, haya los que haya.
export function notebookJumps(notebooks: Notebook[]): [number, Notebook][] {
  const jumps: [number, Notebook][] = notebooks.slice(0, 8).map((c, i) => [i + 1, c])
  if (notebooks.length > 0) jumps.push([9, notebooks.at(-1)!])
  return jumps
}
