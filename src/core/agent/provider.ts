import type { LanguageModel } from "ai"

// Config del Proveedor: por dispositivo, en localStorage (ADR 0027). v1 tracer: solo Anthropic;
// el ticket de Proveedores la vuelve una lista (varios a la vez) sin cambiar `createModel`.
export type ProviderConfig = { kind: "anthropic"; apiKey: string; model: string }

export const PROVIDER_KEY = "bita-agent-provider"
export const PROVIDER_EVENT = "bita-agent-provider"
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5"

export function parseProvider(stored: string | null): ProviderConfig | null {
  try {
    const raw = JSON.parse(stored ?? "null")
    return raw?.kind === "anthropic" && raw.apiKey && raw.model ? raw : null
  } catch {
    return null
  }
}

export function saveProvider(config: ProviderConfig | null) {
  if (config) localStorage.setItem(PROVIDER_KEY, JSON.stringify(config))
  else localStorage.removeItem(PROVIDER_KEY)
  window.dispatchEvent(new Event(PROVIDER_EVENT))
}

// El SDK del Proveedor baja recién acá (import()), no con el bundle principal.
export async function createModel(config: ProviderConfig): Promise<LanguageModel> {
  const { createAnthropic } = await import("@ai-sdk/anthropic")
  return createAnthropic({
    apiKey: config.apiKey,
    // Anthropic exige este header para llamadas directas desde el browser (BYOK, ADR 0027).
    headers: { "anthropic-dangerous-direct-browser-access": "true" },
  })(config.model)
}
