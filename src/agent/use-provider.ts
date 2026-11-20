import { useMemo } from "react"
import { useStored } from "@/core/lib/hooks/use-stored"
import { PROVIDER_KEY, parseAgentSettings, resolveActive } from "@/core/agent/provider"

// Proveedores configurados en este dispositivo + el modelo activo (null = nada visible → empty
// state del Agente).
export function useAgentSettings() {
  const raw = useStored(PROVIDER_KEY)
  return useMemo(() => {
    const settings = parseAgentSettings(raw)
    return { settings, active: resolveActive(settings) }
  }, [raw])
}
