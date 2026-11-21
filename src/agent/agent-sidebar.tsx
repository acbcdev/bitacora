import { lazy, Suspense, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { useMatch } from "react-router-dom"
import {
  DRAWER_TALL,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/core/ui/drawer"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
import { Sidebar, SidebarProvider } from "@/core/ui/sidebar"
import { useAgentUi } from "@/agent/agent-ui"

// Lazy: el AI SDK y el chat bajan recién la primera vez que se abre el Agente.
const AgentPanel = lazy(() => import("@/agent/agent-panel"))

// UN solo panel (y por eso un solo hilo activo) para sidebar, pestaña del notebook, Drawer y ruta
// `/chat/:id`. Vaul desmonta su contenido al cerrar y la ruta/sidebar se montan y desmontan al
// navegar, así que `AgentHost` (siempre montado en la app) renderiza el panel en `host` por portal
// y `AgentSlot` cuelga ese nodo donde esté la superficie visible. Solo se monta una vez abierto
// (o al entrar a la ruta) y después queda: cerrar no pierde el hilo ni el Deshacer del toast.
const host = document.createElement("div")
host.className = "flex min-h-0 flex-1 flex-col"

export function AgentHost() {
  const { open } = useAgentUi()
  const inChat = useMatch("/chat/:id")
  const opened = useRef(false)
  if (open || inChat) opened.current = true
  if (!opened.current) return null
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
        <DrawerContent className={DRAWER_TALL}>
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
        <AgentSlot />
      </Sidebar>
    </SidebarProvider>
  )
}

// Vista grande del mismo hilo: `/chat/:id`. El panel (en `host`) resuelve el id.
export function ChatRoute() {
  return (
    <div className="flex h-dvh flex-col">
      <AgentSlot />
    </div>
  )
}
