import {
  fetchModels,
  mergeModels,
  parseAgentSettings,
  resolveActive,
  visibleModels,
  withoutProvider,
  MAX_VISIBLE,
  type AgentSettings,
  type ProviderConfig,
} from "@/core/agent/provider"

const prov = (over: Partial<ProviderConfig> = {}): ProviderConfig => ({
  id: "p1",
  kind: "anthropic",
  name: "Anthropic",
  apiKey: "k",
  models: [{ id: "a", visible: true }],
  ...over,
})
const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
    }),
  )

test("parseAgentSettings: vacío o corrupto = sin Proveedores", () => {
  expect(parseAgentSettings(null)).toEqual({ providers: [], active: null })
  expect(parseAgentSettings("{x")).toEqual({ providers: [], active: null })
})

test("parseAgentSettings migra el Proveedor único del ticket 02", () => {
  const s = parseAgentSettings(JSON.stringify({ kind: "anthropic", apiKey: "k", model: "m" }))
  expect(s.providers).toHaveLength(1)
  expect(s.providers[0]).toMatchObject({
    kind: "anthropic",
    apiKey: "k",
    models: [{ id: "m", visible: true }],
  })
  expect(s.active).toEqual({ providerId: s.providers[0].id, modelId: "m" })
})

test("fetchModels: Anthropic pega a /v1/models con sus headers", async () => {
  const f = vi.fn(() => json({ data: [{ id: "x" }, { id: "y" }] }))
  expect(await fetchModels(prov(), f as never)).toEqual(["x", "y"])
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe("https://api.anthropic.com/v1/models?limit=1000")
  expect(init.headers).toMatchObject({ "x-api-key": "k" })
})

test("fetchModels: compatible usa baseUrl/models y key opcional", async () => {
  const f = vi.fn(() => json({ data: [{ id: "llama3" }] }))
  const p = prov({
    kind: "openai-compatible",
    baseUrl: "http://localhost:11434/v1/",
    apiKey: "",
  })
  expect(await fetchModels(p, f as never)).toEqual(["llama3"])
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe("http://localhost:11434/v1/models")
  expect(init.headers).not.toHaveProperty("Authorization")
})

test("fetchModels: el fallo sale con el error crudo", async () => {
  await expect(fetchModels(prov(), (() => json("bad key", 401)) as never)).rejects.toThrow(
    "401 bad key",
  )
  await expect(
    fetchModels(prov(), (() => Promise.reject(new TypeError("Failed to fetch"))) as never),
  ).rejects.toThrow("Failed to fetch")
})

test("mergeModels: hasta MAX_VISIBLE visibles, el resto oculto; conserva lo ya elegido", () => {
  const ids = Array.from({ length: MAX_VISIBLE + 5 }, (_, i) => `m${i}`)
  const merged = mergeModels([], ids)
  expect(merged.filter((m) => m.visible)).toHaveLength(MAX_VISIBLE)
  const again = mergeModels([{ id: "m0", visible: false }], ids)
  expect(again.find((m) => m.id === "m0")?.visible).toBe(false)
})

test("visibleModels junta los visibles de todos los Proveedores", () => {
  const s: AgentSettings = {
    providers: [
      prov(),
      prov({
        id: "p2",
        kind: "openrouter",
        models: [
          { id: "b", visible: true },
          { id: "c", visible: false },
        ],
      }),
    ],
    active: null,
  }
  expect(visibleModels(s).map((m) => `${m.provider.id}:${m.id}`)).toEqual(["p1:a", "p2:b"])
})

test("resolveActive: el elegido; si ya no es visible, el primero visible; sin nada, null", () => {
  const s: AgentSettings = {
    providers: [prov(), prov({ id: "p2", models: [{ id: "b", visible: true }] })],
    active: { providerId: "p2", modelId: "b" },
  }
  expect(resolveActive(s)).toMatchObject({
    modelId: "b",
    provider: { id: "p2" },
  })
  expect(resolveActive({ ...s, active: { providerId: "zz", modelId: "b" } })?.modelId).toBe("a")
  expect(resolveActive({ providers: [], active: null })).toBeNull()
})

test("withoutProvider: borrar el Proveedor activo suelta el modelo activo", () => {
  const s: AgentSettings = {
    providers: [prov()],
    active: { providerId: "p1", modelId: "a" },
  }
  expect(withoutProvider(s, "p1")).toEqual({ providers: [], active: null })
  expect(resolveActive(withoutProvider(s, "p1"))).toBeNull()
})
