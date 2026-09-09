import { useSyncExternalStore } from "react"

// Pin es preferencia de UI pura (qué notebooks aparecen fijados en el sidebar), no dato de negocio:
// localStorage alcanza, sin tabla ni migración. useSyncExternalStore para que el sidebar y el
// menú de acciones de Notebooks (dos árboles de componentes distintos) vean el mismo estado sin
// prop drilling ni Context.
// Versión en la clave: si la forma cambia, se cambia la clave y lo viejo se ignora sin crashear.
const KEY = "bita-pinned-notebooks:v1"
const LEGACY_KEYS = ["bita-pinned-notebooks", "bita-pinned-courses"] // la segunda: pre-renombre 0012
const listeners = new Set<() => void>()

function read(): string[] {
  try {
    const raw =
      localStorage.getItem(KEY) ??
      LEGACY_KEYS.map((k) => localStorage.getItem(k)).find(Boolean) ??
      null
    const ids = JSON.parse(raw ?? "[]") as string[]
    if (!Array.isArray(ids)) return []
    if (raw && !localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(ids))
    return ids
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
