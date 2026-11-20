import { useMemo, useSyncExternalStore } from "react"
import { PROVIDER_EVENT, PROVIDER_KEY, parseProvider } from "@/core/agent/provider"

const subscribe = (cb: () => void) => {
  window.addEventListener(PROVIDER_EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(PROVIDER_EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

// El Proveedor configurado en este dispositivo (null = sin configurar → empty state del Agente).
export function useProvider() {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(PROVIDER_KEY))
  return useMemo(() => parseProvider(raw), [raw])
}
