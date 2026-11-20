import { useMemo, useSyncExternalStore } from "react"
import {
  PROVIDER_EVENT,
  PROVIDER_KEY,
  parseAgentSettings,
  resolveActive,
} from "@/core/agent/provider"

const subscribe = (cb: () => void) => {
  window.addEventListener(PROVIDER_EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(PROVIDER_EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

// Proveedores configurados en este dispositivo + el modelo activo (null = nada visible → empty
// state del Agente).
export function useAgentSettings() {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(PROVIDER_KEY))
  return useMemo(() => {
    const settings = parseAgentSettings(raw)
    return { settings, active: resolveActive(settings) }
  }, [raw])
}
