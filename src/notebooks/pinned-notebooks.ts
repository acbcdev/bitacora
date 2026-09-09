import { useSyncExternalStore } from "react"

// Pin es preferencia de UI pura (qué notebooks aparecen fijados en el sidebar), no dato de negocio:
// localStorage alcanza, sin tabla ni migración. useSyncExternalStore para que el sidebar y el
// menú de acciones de Notebooks (dos árboles de componentes distintos) vean el mismo estado sin
// prop drilling ni Context.
const KEY = "bita-pinned-notebooks"
// Renombre Course → Notebook (0012): los pins viejos viven bajo la clave anterior. 2 líneas y
// no se pierden — no vale la pena un flag para una preferencia de UI.
const OLD_KEY = "bita-pinned-courses"
const listeners = new Set<() => void>()

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY)
    if (raw && !localStorage.getItem(KEY)) localStorage.setItem(KEY, raw)
    return JSON.parse(raw ?? "[]")
  } catch {
    return []
  }
}

let cache = read()

export function isNotebookPinned(id: string) {
  return cache.includes(id)
}

export function togglePinnedNotebook(id: string) {
  cache = cache.includes(id) ? cache.filter((x) => x !== id) : [...cache, id]
  localStorage.setItem(KEY, JSON.stringify(cache))
  listeners.forEach((l) => l())
}

export function usePinnedNotebookIds() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => cache,
  )
}
