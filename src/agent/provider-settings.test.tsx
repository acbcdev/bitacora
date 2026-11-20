import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ProviderSettings } from "@/agent/provider-settings"
import { parseAgentSettings } from "@/core/agent/provider"

beforeEach(() => localStorage.clear())

const saved = () => parseAgentSettings(localStorage.getItem("bita-agent-provider"))

test("Compatible: probar conexión fallida muestra el error crudo y deja guardar con id a mano", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
  )
  render(<ProviderSettings />)
  fireEvent.click(screen.getByRole("button", { name: /Compatible con OpenAI/ }))
  fireEvent.click(screen.getByRole("button", { name: "Ollama" }))
  expect(screen.getByText(/OLLAMA_ORIGINS=/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Probar conexión" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch")
  expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  fireEvent.change(screen.getByLabelText("Id de modelo"), {
    target: { value: "llama3" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Agregar" }))
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
  await waitFor(() => expect(saved().providers).toHaveLength(1))
  expect(saved()).toMatchObject({
    providers: [{ kind: "openai-compatible", baseUrl: "http://localhost:11434/v1" }],
    active: { modelId: "llama3" },
  })
  vi.unstubAllGlobals()
})

test("varios Proveedores a la vez; quitar el activo cae al otro", async () => {
  const p = (id: string, m: string) => ({
    id,
    kind: "anthropic",
    name: id,
    apiKey: "k",
    models: [{ id: m, visible: true }],
  })
  localStorage.setItem(
    "bita-agent-provider",
    JSON.stringify({
      providers: [p("a", "m1"), p("b", "m2")],
      active: { providerId: "a", modelId: "m1" },
    }),
  )
  render(<ProviderSettings />)
  fireEvent.click(screen.getAllByRole("button", { name: "Quitar" })[0])
  await waitFor(() => expect(saved().providers.map((x) => x.id)).toEqual(["b"]))
  expect(saved().active).toBeNull()
})
