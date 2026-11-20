import type { LanguageModel } from "ai"
import type { Caps } from "@/core/agent/capabilities"

// Proveedores del Agente: por dispositivo, en localStorage (ADR 0027). Varios a la vez; cada uno
// guarda su lista de modelos con visibilidad. `ModelEntry` es el punto de extensión de metadata
// por modelo (ej. capacidades).
export type ProviderKind = "anthropic" | "openrouter" | "openai-compatible"
export type ModelEntry = { id: string; visible: boolean; caps?: Caps }
export type ProviderConfig = {
  id: string
  kind: ProviderKind
  name: string
  apiKey: string // vacío solo en compatible (ej. Ollama)
  baseUrl?: string // solo compatible
  preset?: string // ícono/etiqueta del preset (ollama, lmstudio, openai, gemini)
  models: ModelEntry[]
}
export type ActiveModel = { providerId: string; modelId: string }
export type AgentSettings = {
  providers: ProviderConfig[]
  active: ActiveModel | null
}

export const PROVIDER_KEY = "bita-agent-provider"
export const PROVIDER_EVENT = "bita-agent-provider"
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5"
export const MAX_VISIBLE = 30

export const OPENROUTER_URL = "https://openrouter.ai/api/v1"
export const PRESETS = [
  {
    key: "ollama",
    name: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    local: true,
  },
  {
    key: "lmstudio",
    name: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    local: true,
  },
  {
    key: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    local: false,
  },
  {
    key: "gemini",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    local: false,
  },
] as const

const EMPTY: AgentSettings = { providers: [], active: null }

export function parseAgentSettings(stored: string | null): AgentSettings {
  try {
    const raw = JSON.parse(stored ?? "null")
    if (Array.isArray(raw?.providers)) return raw
    // Formato del ticket 02: un solo Proveedor Anthropic { kind, apiKey, model }.
    if (raw?.kind === "anthropic" && raw.apiKey && raw.model) {
      const id = crypto.randomUUID()
      const p: ProviderConfig = {
        id,
        kind: "anthropic",
        name: "Anthropic",
        apiKey: raw.apiKey,
        models: [{ id: raw.model, visible: true }],
      }
      return { providers: [p], active: { providerId: id, modelId: raw.model } }
    }
  } catch {
    // corrupto: se trata como sin configurar
  }
  return EMPTY
}

export function saveAgentSettings(settings: AgentSettings) {
  if (settings.providers.length) localStorage.setItem(PROVIDER_KEY, JSON.stringify(settings))
  else localStorage.removeItem(PROVIDER_KEY)
  window.dispatchEvent(new Event(PROVIDER_EVENT))
}

export type VisibleModel = ModelEntry & { provider: ProviderConfig }

export function visibleModels(s: AgentSettings): VisibleModel[] {
  return s.providers.flatMap((provider) =>
    provider.models.filter((m) => m.visible).map((m) => ({ ...m, provider })),
  )
}

// Modelo activo (Proveedor, id) por dispositivo. Si el elegido ya no existe/visible cae al primero
// visible; sin ninguno → null (empty state del Agente).
export function resolveActive(
  s: AgentSettings,
): { provider: ProviderConfig; modelId: string } | null {
  const all = visibleModels(s)
  const hit =
    all.find((m) => m.provider.id === s.active?.providerId && m.id === s.active.modelId) ?? all[0]
  return hit ? { provider: hit.provider, modelId: hit.id } : null
}

export function withoutProvider(s: AgentSettings, id: string): AgentSettings {
  return {
    providers: s.providers.filter((p) => p.id !== id),
    active: s.active?.providerId === id ? null : s.active,
  }
}

// Inserta o reemplaza un Proveedor; si no había modelo activo elige su primer visible.
export function withProvider(s: AgentSettings, p: ProviderConfig): AgentSettings {
  const providers = s.providers.some((x) => x.id === p.id)
    ? s.providers.map((x) => (x.id === p.id ? p : x))
    : [...s.providers, p]
  const first = p.models.find((m) => m.visible)
  const active = s.active ?? (first ? { providerId: p.id, modelId: first.id } : null)
  return { providers, active }
}

// Mantiene la visibilidad ya elegida; los nuevos quedan visibles hasta llenar MAX_VISIBLE.
export function mergeModels(
  prev: ModelEntry[],
  ids: string[],
  caps: Record<string, Caps> = {},
): ModelEntry[] {
  const seen = new Map(prev.map((m) => [m.id, m]))
  let visible = ids.filter((id) => seen.get(id)?.visible).length
  return ids.map((id) => {
    const known = seen.get(id)
    const c = caps[id] ?? known?.caps
    const withCaps = c ? { caps: c } : {}
    if (known) return { id, visible: known.visible, ...withCaps }
    const show = visible < MAX_VISIBLE
    if (show) visible++
    return { id, visible: show, ...withCaps }
  })
}

function modelsRequest(c: ProviderConfig): [string, Record<string, string>] {
  if (c.kind === "anthropic")
    return [
      "https://api.anthropic.com/v1/models?limit=1000",
      {
        "x-api-key": c.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
    ]
  const base = c.kind === "openrouter" ? OPENROUTER_URL : (c.baseUrl ?? "").replace(/\/+$/, "")
  return [`${base}/models`, c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {}]
}

// "Probar conexión": GET /models. Falla con el error crudo (status + body, o el de red/CORS).
export async function fetchModels(c: ProviderConfig, f: typeof fetch = fetch): Promise<string[]> {
  const [url, headers] = modelsRequest(c)
  const res = await f(url, { headers })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text}`)
  const data = JSON.parse(text)?.data
  if (!Array.isArray(data)) throw new Error("Respuesta inesperada de /models")
  return data.map((m: { id: string }) => m.id)
}

// El SDK del Proveedor baja recién acá (import()), no con el bundle principal.
export async function createModel(c: ProviderConfig, modelId: string): Promise<LanguageModel> {
  if (c.kind === "anthropic") {
    const { createAnthropic } = await import("@ai-sdk/anthropic")
    return createAnthropic({
      apiKey: c.apiKey,
      // Anthropic exige este header para llamadas directas desde el browser (BYOK, ADR 0027).
      headers: { "anthropic-dangerous-direct-browser-access": "true" },
    })(modelId)
  }
  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible")
  return createOpenAICompatible({
    name: c.kind === "openrouter" ? "openrouter" : (c.preset ?? "openai-compatible"),
    baseURL: c.kind === "openrouter" ? OPENROUTER_URL : (c.baseUrl ?? ""),
    apiKey: c.apiKey || undefined,
  })(modelId)
}
