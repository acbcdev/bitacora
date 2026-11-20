import { lazy, Suspense, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/core/ui/drawer"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
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

// Mobile: el chat vive en un nodo propio que se re-parenta al Drawer abierto. Vaul desmonta su
// contenido al cerrar y el hilo (más el Deshacer del toast) no puede morir con él, así que
// `AgentHost` (siempre montado en la app) renderiza el panel en `host` por portal y `AgentSlot`
// lo cuelga donde esté el Drawer.
const host = document.createElement("div")
host.className = "flex min-h-0 flex-1 flex-col"

export function AgentHost() {
  const { open } = useAgentUi()
  const isMobile = useIsMobile()
  const opened = useRef(false)
  if (open) opened.current = true
  if (!isMobile || !opened.current) return null
  return createPortal(
    <Suspense fallback={null}>
      <AgentPanel />
    </Suspense>,
    host,
  )
}

export function AgentSlot() {
  const attach = useCallback((el: HTMLDivElement | null) => {
    el?.appendChild(host)
  }, [])
  return <div ref={attach} className="flex min-h-0 flex-1 flex-col" />
}

// Sidebar derecho del Agente fuera de notebooks. SidebarProvider anidado con `contents`: el
// `sidebar-gap` pasa a ser hijo flex del provider de la app y empuja `<main>`. Sin ⌘B propio.
export function AgentSidebar() {
  const { open, setOpen } = useAgentUi()
  const isMobile = useIsMobile()
  // Fuera de notebooks no hay pestañas: solo Agente.
  if (isMobile)
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="h-[85dvh]">
          <DrawerTitle className="sr-only">Agente</DrawerTitle>
          <DrawerDescription className="sr-only">Chat con el Agente</DrawerDescription>
          <AgentSlot />
        </DrawerContent>
      </Drawer>
    )
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
