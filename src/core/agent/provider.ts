import type { LanguageModel } from "ai"
import type { Caps } from "@/core/agent/capabilities"
import { setStored } from "@/core/lib/hooks/use-stored"

// Proveedores del Agente: por dispositivo, en localStorage (ADR 0027). Varios a la vez; cada uno
// guarda su lista de modelos con visibilidad. `ModelEntry` es el punto de extensión de metadata
// por modelo (ej. capacidades).
export type ProviderKind = "anthropic" | "openrouter" | "openai-compatible"
// Metadata que /models ya trae, best-effort: `created` = unix s, `price` = USD por 1M tokens [in, out].
export type Info = { created?: number; context?: number; price?: [number, number] }
export type ModelEntry = { id: string; visible: boolean; caps?: Caps; info?: Info }
export type RemoteModel = { id: string; info?: Info }
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

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null

function validProvider(p: unknown): boolean {
  return (
    isObj(p) &&
    typeof p.id === "string" &&
    typeof p.kind === "string" &&
    typeof p.apiKey === "string" &&
    Array.isArray(p.models) &&
    p.models.every((m) => isObj(m) && typeof m.id === "string" && typeof m.visible === "boolean")
  )
}

export function parseAgentSettings(stored: string | null): AgentSettings {
  try {
    const raw = JSON.parse(stored ?? "null")
    if (Array.isArray(raw?.providers) && raw.providers.every(validProvider)) return raw
  } catch {
    // corrupto: se trata como sin configurar
  }
  return EMPTY
}

export function saveAgentSettings(settings: AgentSettings) {
  setStored(PROVIDER_KEY, settings.providers.length ? JSON.stringify(settings) : null)
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
  remote: RemoteModel[],
  caps: Record<string, Caps> = {},
): ModelEntry[] {
  const seen = new Map(prev.map((m) => [m.id, m]))
  let visible = remote.filter((r) => seen.get(r.id)?.visible).length
  return remote.map(({ id, info: fresh }) => {
    const known = seen.get(id)
    const c = caps[id] ?? known?.caps
    const info = fresh ?? known?.info
    const extra = { ...(c && { caps: c }), ...(info && { info }) }
    if (known) return { id, visible: known.visible, ...extra }
    const show = visible < MAX_VISIBLE
    if (show) visible++
    return { id, visible: show, ...extra }
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

const num = (x: unknown) => {
  const v = Number(x)
  return x != null && x !== "" && Number.isFinite(v) && v >= 0 ? v : undefined
}

// Cada API usa sus nombres: OpenAI/OpenRouter `created`, Anthropic `created_at`; contexto en
// `context_length` (OpenRouter) o `max_input_tokens` (Anthropic); precios por token (OpenRouter).
// Ollama: `created` es la fecha del archivo local, no del lanzamiento → se ignora.
function parseInfo(m: Record<string, any>, dated: boolean): Info | undefined {
  const info: Info = {}
  const created = dated ? (num(m.created) ?? num(Date.parse(m.created_at) / 1000)) : undefined
  const context = num(m.context_length) ?? num(m.max_input_tokens)
  const [pIn, pOut] = [num(m.pricing?.prompt), num(m.pricing?.completion)]
  if (created != null) info.created = created
  if (context != null) info.context = context
  if (pIn != null && pOut != null) info.price = [pIn * 1e6, pOut * 1e6]
  return Object.keys(info).length ? info : undefined
}

// "Probar conexión": GET /models. Falla con el error crudo (status + body, o el de red/CORS).
export async function fetchModels(
  c: ProviderConfig,
  f: typeof fetch = fetch,
): Promise<RemoteModel[]> {
  const [url, headers] = modelsRequest(c)
  const res = await f(url, { headers })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`)
  const data = JSON.parse(text)?.data
  if (!Array.isArray(data)) throw new Error("Respuesta inesperada de /models")
  return data.map((m: Record<string, any>) => {
    const info = parseInfo(m, c.preset !== "ollama")
    return { id: m.id, ...(info && { info }) }
  })
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
