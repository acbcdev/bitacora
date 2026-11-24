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

test("parseAgentSettings: forma inválida = sin Proveedores", () => {
  const empty = { providers: [], active: null }
  for (const bad of [
    '{"providers":"x"}',
    '{"providers":[null]}',
    '{"providers":[{"id":"p"}]}',
    '{"providers":[{"id":"p","kind":"anthropic","name":"A","apiKey":"k","models":"x"}]}',
    '{"kind":"anthropic","apiKey":"k","model":"m"}',
  ])
    expect(parseAgentSettings(bad)).toEqual(empty)
})

test("parseAgentSettings: acepta settings válidos", () => {
  const s = { providers: [prov()], active: { providerId: "p1", modelId: "a" } }
  expect(parseAgentSettings(JSON.stringify(s))).toEqual(s)
})

test("fetchModels: Anthropic pega a /v1/models con sus headers", async () => {
  const f = vi.fn(() => json({ data: [{ id: "x" }, { id: "y" }] }))
  expect(await fetchModels(prov(), f as never)).toEqual([{ id: "x" }, { id: "y" }])
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
  expect(await fetchModels(p, f as never)).toEqual([{ id: "llama3" }])
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe("http://localhost:11434/v1/models")
  expect(init.headers).not.toHaveProperty("Authorization")
})

test("fetchModels: trunca el body del error", async () => {
  const err = await fetchModels(prov(), (() => json("x".repeat(5000), 500)) as never).catch(
    (e: Error) => e,
  )
  expect((err as Error).message.length).toBeLessThan(400)
})

test("fetchModels: el fallo sale con el error crudo", async () => {
  await expect(fetchModels(prov(), (() => json("bad key", 401)) as never)).rejects.toThrow(
    "401 bad key",
  )
  await expect(
    fetchModels(prov(), (() => Promise.reject(new TypeError("Failed to fetch"))) as never),
  ).rejects.toThrow("Failed to fetch")
})

test("fetchModels: extrae fecha, contexto y precio por 1M de lo que cada API manda", async () => {
  const anth = vi.fn(() =>
    json({ data: [{ id: "a", created_at: "2025-05-22T00:00:00Z", max_input_tokens: 200000 }] }),
  )
  expect(await fetchModels(prov(), anth as never)).toEqual([
    { id: "a", info: { created: 1747872000, context: 200000 } },
  ])
  const or = vi.fn(() =>
    json({
      data: [
        {
          id: "o",
          created: 1700000000,
          context_length: 128000,
          pricing: { prompt: "0.000003", completion: "0.000015" },
        },
        { id: "auto", pricing: { prompt: "-1", completion: "-1" } },
      ],
    }),
  )
  const [o, auto] = await fetchModels(prov({ kind: "openrouter" }), or as never)
  expect(o.info?.price?.map((p) => +p.toFixed(4))).toEqual([3, 15])
  expect(auto).toEqual({ id: "auto" })
  const ol = vi.fn(() => json({ data: [{ id: "l", created: 1700000000 }] }))
  const p = prov({ kind: "openai-compatible", preset: "ollama", baseUrl: "http://x/v1" })
  expect(await fetchModels(p, ol as never)).toEqual([{ id: "l" }])
})

test("mergeModels: hasta MAX_VISIBLE visibles, el resto oculto; conserva lo ya elegido", () => {
  const ids = Array.from({ length: MAX_VISIBLE + 5 }, (_, i) => `m${i}`)
  const merged = mergeModels(
    [],
    ids.map((id) => ({ id })),
  )
  expect(merged.filter((m) => m.visible)).toHaveLength(MAX_VISIBLE)
  const again = mergeModels(
    [{ id: "m0", visible: false }],
    ids.map((id) => ({ id })),
  )
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
