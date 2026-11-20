import { useSyncExternalStore } from "react"

// localStorage reactivo en la misma pestaña (evento propio con el nombre de la key) y entre
// pestañas (`storage`). `setStored(key, null)` borra.
export function setStored(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key)
  else localStorage.setItem(key, value)
  window.dispatchEvent(new Event(key))
}

export function useStored(key: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(key, cb)
      window.addEventListener("storage", cb)
      return () => {
        window.removeEventListener(key, cb)
        window.removeEventListener("storage", cb)
      }
    },
    () => localStorage.getItem(key),
  )
}
