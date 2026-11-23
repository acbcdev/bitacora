import { lazy, Suspense, useCallback, useRef, useState } from "react"
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
import { PanelRight } from "lucide-react"
import { Button } from "@/core/ui/button"
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
    // replaceChildren, no appendChild: en HMR el módulo crea un `host` nuevo y el viejo (vacío,
    // flex-1) se quedaba de hermano comiéndose media altura.
    el?.replaceChildren(host)
  }, [])
  return <div ref={attach} className="flex min-h-0 flex-1 flex-col" />
}

const MIN_W = 256
const MAX_W = 640
const clamp = (n: number) => Math.min(MAX_W, Math.max(MIN_W, n))

// Ancho redimensionable (px) persistido en localStorage; el borde izquierdo es el handle.
export function useSidebarWidth(key: string, initial: number) {
  const [width, setWidth] = useState(() => clamp(Number(localStorage.getItem(key)) || initial))
  const [dragging, setDragging] = useState(false)
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (dragging) setWidth(clamp(window.innerWidth - e.clientX))
    },
    onPointerUp: () => {
      setDragging(false)
      localStorage.setItem(key, String(width))
    },
  }
  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar panel"
      {...handlers}
      className="absolute inset-y-0 left-0 z-20 w-1 cursor-col-resize touch-none hover:bg-border active:bg-border"
    />
  )
  return { width, dragging, handle }
}

// Sidebar derecho del Agente fuera de notebooks. SidebarProvider anidado con `contents`: el
// `sidebar-gap` pasa a ser hijo flex del provider de la app y empuja `<main>`. ⌘⌥B abre/cierra.
export function AgentSidebar() {
  const { open, setOpen } = useAgentUi()
  const isMobile = useIsMobile()
  const { width, dragging, handle } = useSidebarWidth("agent-sidebar-width", 384)
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
      alt
      open={open}
      onOpenChange={setOpen}
      // Durante el drag se apaga la transición de width (si no, el panel va 200ms atrás del mouse).
      className={dragging ? "contents **:transition-none!" : "contents"}
      style={{ "--sidebar-width": `${width}px` } as React.CSSProperties}
    >
      {!open && (
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Abrir Agente"
          className="fixed top-4 right-4 z-10"
          onClick={() => setOpen(true)}
        >
          <PanelRight className="size-5" />
        </Button>
      )}
      <Sidebar side="right" collapsible="offcanvas" aria-label="Agente">
        {handle}
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
