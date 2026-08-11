import { useSyncExternalStore } from "react"

// Pin es preferencia de UI pura (qué cursos aparecen fijados en el sidebar), no dato de negocio:
// localStorage alcanza, sin tabla ni migración. useSyncExternalStore para que el sidebar y el
// menú de acciones de Cursos (dos árboles de componentes distintos) vean el mismo estado sin
// prop drilling ni Context.
const KEY = "bita-pinned-courses"
const listeners = new Set<() => void>()

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]")
  } catch {
    return []
  }
}

let cache = read()

export function isCoursePinned(id: string) {
  return cache.includes(id)
}

export function togglePinnedCourse(id: string) {
  cache = cache.includes(id) ? cache.filter((x) => x !== id) : [...cache, id]
  localStorage.setItem(KEY, JSON.stringify(cache))
  listeners.forEach((l) => l())
}

export function usePinnedCourseIds() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => cache,
  )
}
