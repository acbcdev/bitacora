import type { ProviderConfig } from "@/core/agent/provider"

// Capacidades por modelo, best-effort (ticket 08). `undefined` = desconocido = capaz: solo `false`
// muestra badge, y ningún badge bloquea nada.
export type Caps = { tools?: boolean; vision?: boolean }

const OPENROUTER_MODELS = "https://openrouter.ai/api/v1/models"

async function getJson(f: typeof fetch, url: string, init?: RequestInit) {
  const res = await f(url, init)
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

// Ollama: POST /api/show por modelo → `capabilities: ["completion", "tools", "vision", ...]`.
async function ollama(base: string, ids: string[], f: typeof fetch) {
  const out: Record<string, Caps> = {}
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { capabilities } = await getJson(f, `${base}/api/show`, {
          method: "POST",
          body: JSON.stringify({ model: id }),
        })
        if (Array.isArray(capabilities))
          out[id] = {
            tools: capabilities.includes("tools"),
            vision: capabilities.includes("vision"),
          }
      } catch {
        // desconocido
      }
    }),
  )
  return out
}

// LM Studio: GET /api/v0/models → `type: "vlm"` = visión; `capabilities: ["tool_use"]` si la
// versión lo trae (si no, tools queda desconocido).
async function lmstudio(base: string, f: typeof fetch) {
  const out: Record<string, Caps> = {}
  const { data } = await getJson(f, `${base}/api/v0/models`)
  for (const m of data as {
    id: string
    type?: string
    capabilities?: string[]
  }[]) {
    out[m.id] = { vision: m.type === "vlm" }
    if (Array.isArray(m.capabilities)) out[m.id].tools = m.capabilities.includes("tool_use")
  }
  return out
}

// OpenRouter: cada modelo trae `supported_parameters` (incluye "tools") y
// `architecture.input_modalities` (incluye "image"). Si falta uno, ese dato queda desconocido.
async function openrouter(f: typeof fetch) {
  const out: Record<string, Caps> = {}
  const { data } = await getJson(f, OPENROUTER_MODELS)
  for (const m of data as {
    id: string
    supported_parameters?: string[]
    architecture?: { input_modalities?: string[] }
  }[]) {
    const caps: Caps = {}
    if (m.supported_parameters) caps.tools = m.supported_parameters.includes("tools")
    if (m.architecture?.input_modalities)
      caps.vision = m.architecture.input_modalities.includes("image")
    if (Object.keys(caps).length) out[m.id] = caps
  }
  return out
}

// Nunca tira: cualquier falla (CORS, red, formato) = sin datos = todo capaz.
export async function fetchCapabilities(
  c: ProviderConfig,
  ids: string[],
  f: typeof fetch = fetch,
): Promise<Record<string, Caps>> {
  try {
    if (c.kind === "openrouter") return await openrouter(f)
    if (c.kind !== "openai-compatible" || !c.baseUrl) return {}
    const origin = new URL(c.baseUrl).origin
    if (c.preset === "ollama") return await ollama(origin, ids, f)
    if (c.preset === "lmstudio") return await lmstudio(origin, f)
  } catch {
    // best-effort
  }
  return {}
}

// Ventana REAL de Ollama: `/api/ps` da el `context_length` con que se cargó el modelo (num_ctx,
// p. ej. 4096). `/api/show` da el máximo entrenado (262k) y mentiría: lo que pasa num_ctx se
// trunca en silencio. Solo existe con el modelo cargado → consultar tras un turno. Nunca tira.
export async function ollamaWindow(
  c: ProviderConfig,
  modelId: string,
  f: typeof fetch = fetch,
): Promise<number | undefined> {
  if (c.preset !== "ollama" || !c.baseUrl) return undefined
  try {
    const { models } = await getJson(f, `${new URL(c.baseUrl).origin}/api/ps`)
    const n = (models as { model: string; context_length?: number }[]).find(
      (m) => m.model === modelId,
    )?.context_length
    return typeof n === "number" && n > 0 ? n : undefined
  } catch {
    return undefined
  }
}
