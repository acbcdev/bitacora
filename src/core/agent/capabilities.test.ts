import { fetchCapabilities, ollamaWindow } from "@/core/agent/capabilities"
import type { ProviderConfig } from "@/core/agent/provider"

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const prov = (over: Partial<ProviderConfig>): ProviderConfig => ({
  id: "p",
  kind: "openai-compatible",
  name: "x",
  apiKey: "",
  models: [],
  ...over,
})

test("Ollama: POST /api/show por modelo, lee capabilities (tools / vision)", async () => {
  const f = vi.fn((_url: string, init?: RequestInit) => {
    const { model } = JSON.parse(String(init?.body))
    return json({
      capabilities: model === "llava" ? ["completion", "vision"] : ["completion", "tools"],
    })
  })
  const caps = await fetchCapabilities(
    prov({ preset: "ollama", baseUrl: "http://localhost:11434/v1" }),
    ["llava", "qwen"],
    f as never,
  )
  expect(caps).toEqual({
    llava: { tools: false, vision: true },
    qwen: { tools: true, vision: false },
  })
  expect(f.mock.calls[0][0]).toBe("http://localhost:11434/api/show")
  expect((f.mock.calls[0][1] as RequestInit).method).toBe("POST")
})

test("Ollama: si /api/show falla para un modelo queda desconocido (sin entrada)", async () => {
  const f = vi.fn(() => json({ error: "nope" }, 404))
  const caps = await fetchCapabilities(
    prov({ preset: "ollama", baseUrl: "http://localhost:11434/v1" }),
    ["a"],
    f as never,
  )
  expect(caps).toEqual({})
})

test("LM Studio: GET /api/v0/models, type vlm = visión; tool_use en capabilities si viene", async () => {
  const f = vi.fn((_url?: string) =>
    json({
      data: [
        { id: "qwen-vl", type: "vlm", capabilities: ["tool_use"] },
        { id: "gemma", type: "llm", capabilities: [] },
        { id: "viejo", type: "llm" }, // versión sin capabilities: tools desconocido
      ],
    }),
  )
  const caps = await fetchCapabilities(
    prov({ preset: "lmstudio", baseUrl: "http://localhost:1234/v1" }),
    [],
    f as never,
  )
  expect(f.mock.calls[0][0]).toBe("http://localhost:1234/api/v0/models")
  expect(caps).toEqual({
    "qwen-vl": { tools: true, vision: true },
    gemma: { tools: false, vision: false },
    viejo: { vision: false },
  })
})

test("OpenRouter: supported_parameters incluye 'tools', architecture.input_modalities incluye 'image'", async () => {
  const f = vi.fn((_url?: string) =>
    json({
      data: [
        {
          id: "a/vision",
          supported_parameters: ["tools", "max_tokens"],
          architecture: { input_modalities: ["text", "image"] },
        },
        {
          id: "b/plain",
          supported_parameters: ["max_tokens"],
          architecture: { input_modalities: ["text"] },
        },
        { id: "c/sin-datos" },
      ],
    }),
  )
  const caps = await fetchCapabilities(prov({ kind: "openrouter" }), [], f as never)
  expect(caps).toEqual({
    "a/vision": { tools: true, vision: true },
    "b/plain": { tools: false, vision: false },
  })
})

test("Anthropic y compatibles genéricos: desconocido = capaz, nunca tira", async () => {
  const f = vi.fn()
  expect(await fetchCapabilities(prov({ kind: "anthropic" }), ["m"], f as never)).toEqual({})
  expect(await fetchCapabilities(prov({ preset: "openai" }), ["m"], f as never)).toEqual({})
  expect(f).not.toHaveBeenCalled()
  const boom = vi.fn(() => Promise.reject(new Error("CORS")))
  expect(await fetchCapabilities(prov({ kind: "openrouter" }), [], boom as never)).toEqual({})
})

test("ollamaWindow: num_ctx de /api/ps (no el máximo de /api/show); sin dato o falla = undefined", async () => {
  const ollama = prov({ preset: "ollama", baseUrl: "http://localhost:11434/v1" })
  const ps = vi.fn(() => json({ models: [{ model: "nemo:4b", context_length: 4096 }] }))
  expect(await ollamaWindow(ollama, "nemo:4b", ps as unknown as typeof fetch)).toBe(4096)
  expect(ps).toHaveBeenCalledWith("http://localhost:11434/api/ps", undefined)
  expect(await ollamaWindow(ollama, "otro", ps as unknown as typeof fetch)).toBeUndefined()
  const down = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")))
  expect(await ollamaWindow(ollama, "nemo:4b", down as unknown as typeof fetch)).toBeUndefined()
  expect(
    await ollamaWindow(
      prov({ preset: "lmstudio", baseUrl: "http://x" }),
      "m",
      ps as unknown as typeof fetch,
    ),
  ).toBeUndefined()
})
