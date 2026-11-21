import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AgentUiContext } from "@/agent/agent-ui"
import { AgentHost, AgentSidebar, ChatRoute } from "@/agent/agent-sidebar"
import { saveAgentSettings } from "@/core/agent/provider"
import { TooltipProvider } from "@/core/ui/tooltip"

// Un turno que nunca termina: el Agente queda ocupado mientras se cambia de superficie.
vi.mock("@/core/agent/provider", async (orig) => ({
  ...(await orig<object>()),
  createModel: async () => ({}),
}))
vi.mock("@/core/agent/turn", () => ({ runTurn: () => new Promise(() => {}) }))

function chat(id: string, text: string, updatedAt: number) {
  return { id, createdAt: updatedAt, updatedAt, messages: [{ role: "user", content: text }] }
}

// Misma composición que el Shell: un Host, el sidebar fuera de /chat y la ruta.
function App() {
  const { pathname } = useLocation()
  return (
    <>
      <span data-testid="path">{pathname}</span>
      <Routes>
        <Route path="/" element={<AgentSidebar />} />
        <Route path="/chat/:id" element={<ChatRoute />} />
      </Routes>
      <AgentHost />
    </>
  )
}

function setup(path: string, chats: ReturnType<typeof chat>[]) {
  localStorage.clear()
  saveAgentSettings({
    providers: [
      { id: "p", kind: "anthropic", name: "A", apiKey: "k", models: [{ id: "m", visible: true }] },
    ],
    active: { providerId: "p", modelId: "m" },
  })
  localStorage.setItem("agent.chats", JSON.stringify(chats))
  const setOpen = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <AgentUiContext.Provider value={{ open: true, setOpen, openSettings: () => {} }}>
            <App />
          </AgentUiContext.Provider>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return setOpen
}

const path = () => screen.getByTestId("path").textContent

test("sidebar y ruta comparten UN hilo activo", async () => {
  setup("/", [chat("a", "pregunta A", 2), chat("b", "pregunta B", 1)])
  await screen.findByRole("button", { name: "Chats" })
  // Abrir B en el sidebar y pasar a grande: sigue siendo B (no un hilo nuevo ni el más reciente).
  fireEvent.pointerDown(screen.getByRole("button", { name: "Chats" }), { button: 0 })
  fireEvent.click(await screen.findByText("pregunta B"))
  fireEvent.click(screen.getByRole("button", { name: "Abrir en grande" }))
  expect(path()).toBe("/chat/b")
  expect(await screen.findByRole("button", { name: "Contraer" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Chats" })).toHaveTextContent("pregunta B")
  // Contraer vuelve al sidebar con el mismo hilo (sin historial previo cae a "/").
  fireEvent.click(screen.getByRole("button", { name: "Contraer" }))
  expect(path()).toBe("/")
  expect(await screen.findByRole("button", { name: "Abrir en grande" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Chats" })).toHaveTextContent("pregunta B")
})

test("id inexistente redirige al chat más reciente", async () => {
  setup("/chat/borrado", [chat("a", "pregunta A", 2), chat("b", "pregunta B", 1)])
  await screen.findByRole("button", { name: "Contraer" })
  expect(path()).toBe("/chat/a")
  expect(screen.getByRole("button", { name: "Chats" })).toHaveTextContent("pregunta A")
})

test("id inexistente sin chats cae a uno nuevo", async () => {
  setup("/chat/borrado", [])
  await screen.findByRole("button", { name: "Contraer" })
  expect(path()).toMatch(/^\/chat\/[0-9a-f-]{36}$/)
  expect(screen.getByRole("button", { name: "Chats" })).toHaveTextContent("Nuevo chat")
})

test("Cerrar en el sidebar cierra el Agente", async () => {
  const setOpen = setup("/", [])
  fireEvent.click(await screen.findByRole("button", { name: "Cerrar" }))
  expect(setOpen).toHaveBeenCalledWith(false)
})

test("un turno en curso sobrevive al pasar del sidebar a la ruta (mismo hilo, no uno nuevo)", async () => {
  setup("/", [])
  fireEvent.change(await screen.findByRole("textbox", { name: "Mensaje al Agente" }), {
    target: { value: "hola" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
  expect(await screen.findByRole("button", { name: "Detener" })).toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "Abrir en grande" }))
  expect(path()).toMatch(/^\/chat\//)
  // Mismo panel: sigue ocupado y el mensaje enviado sigue en el hilo.
  expect(await screen.findByRole("button", { name: "Contraer" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Detener" })).toBeInTheDocument()
  expect(screen.getByText("pensando…")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Chats" })).toHaveTextContent("hola")
})
