import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { TooltipProvider } from "@/core/ui/tooltip"
import { ProviderSettings } from "@/agent/provider-settings"
import { parseAgentSettings } from "@/core/agent/provider"

beforeEach(() => localStorage.clear())

// Los toggles de capacidades usan Tooltip, que en la app vive bajo el TooltipProvider de app.tsx.
const renderSettings = () =>
  render(
    <TooltipProvider>
      <ProviderSettings />
    </TooltipProvider>,
  )

const saved = () => parseAgentSettings(localStorage.getItem("bita-agent-provider"))

test("Compatible: probar conexión fallida muestra el error crudo y deja guardar con id a mano", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
  )
  renderSettings()
  fireEvent.click(screen.getByRole("button", { name: /Compatible con OpenAI/ }))
  fireEvent.click(screen.getByRole("button", { name: "Ollama" }))
  expect(screen.getByText(/OLLAMA_ORIGINS=/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Probar conexión" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch")
  expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  // El buscador también da de alta: sin coincidencias, Enter agrega el id tipeado.
  const search = screen.getByLabelText("Buscar o agregar modelo")
  fireEvent.change(search, { target: { value: "llama3" } })
  fireEvent.keyDown(search, { key: "Enter" })
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
  renderSettings()
  fireEvent.click(screen.getAllByRole("button", { name: "Quitar" })[0])
  // Quitar es destructivo: pide confirmación y Cancelar no toca nada.
  const dialog = await screen.findByRole("alertdialog")
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(saved().providers).toHaveLength(2)
  fireEvent.click(screen.getAllByRole("button", { name: "Quitar" })[0])
  fireEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Quitar" }),
  )
  await waitFor(() => expect(saved().providers.map((x) => x.id)).toEqual(["b"]))
  expect(saved().active).toBeNull()
})

test("modelos: filtro por visión, y Enter con coincidencias no crea un id a medias", () => {
  const ids = Array.from({ length: 10 }, (_, i) => `model-${i}`)
  localStorage.setItem(
    "bita-agent-provider",
    JSON.stringify({
      providers: [
        {
          id: "a",
          kind: "anthropic",
          name: "A",
          apiKey: "k",
          models: ids.map((id, i) => ({
            id,
            visible: i < 4,
            caps: { vision: i % 5 === 0 },
          })),
        },
      ],
      active: null,
    }),
  )
  renderSettings()
  fireEvent.click(screen.getByRole("button", { name: "Editar" }))
  expect(screen.getByText(/10 modelos/, { selector: "span" })).toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "Solo con visión" }))
  expect(screen.getByText(/2 modelos/, { selector: "span" })).toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "Limpiar" }))
  const search = screen.getByLabelText("Buscar o agregar modelo")
  fireEvent.change(search, { target: { value: "mod" } })
  fireEvent.keyDown(search, { key: "Enter" })
  // "mod" es parcial y hay coincidencias: Enter NO crea un modelo "mod"; la fila se clickea.
  expect(screen.getAllByRole("checkbox", { name: /^model-/ })).toHaveLength(10)
  fireEvent.click(screen.getByText(/a mano/))
  expect(screen.getByRole("checkbox", { name: "mod" })).toBeChecked()
})
