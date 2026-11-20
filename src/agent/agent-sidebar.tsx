import { lazy, Suspense, useRef } from "react"
import { Sidebar, SidebarProvider } from "@/core/ui/sidebar"
import { useAgentUi } from "@/agent/agent-ui"

// Lazy: el AI SDK y el chat bajan recién la primera vez que se abre el Agente.
const AgentPanel = lazy(() => import("@/agent/agent-panel"))

// El panel solo se monta una vez abierto, y después queda montado (cerrar no pierde el hilo).
export function AgentContent() {
  const { open } = useAgentUi()
  const opened = useRef(false)
  if (open) opened.current = true
  if (!opened.current) return null
  return (
    <Suspense fallback={null}>
      <AgentPanel />
    </Suspense>
  )
}

// Sidebar derecho del Agente fuera de notebooks. SidebarProvider anidado con `contents`: el
// `sidebar-gap` pasa a ser hijo flex del provider de la app y empuja `<main>`. Sin ⌘B propio.
export function AgentSidebar() {
  const { open, setOpen } = useAgentUi()
  return (
    <SidebarProvider
      shortcut={false}
      open={open}
      onOpenChange={setOpen}
      className="contents"
      style={
        {
          "--sidebar-width": "clamp(18rem, 24vw, 24rem)",
        } as React.CSSProperties
      }
    >
      <Sidebar side="right" collapsible="offcanvas" aria-label="Agente">
        <AgentContent />
      </Sidebar>
    </SidebarProvider>
  )
}
