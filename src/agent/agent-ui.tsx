import { createContext, useContext } from "react"

// Estado de superficie del Agente (abierto/cerrado), compartido entre Shell (⌘., sidebar propio)
// y Notebook (pestaña "Agente" del sidebar del índice). El Agente en sí vive en `agent-panel`.
export type AgentUi = {
  open: boolean
  setOpen: (open: boolean) => void
  openSettings: () => void
}

export const AgentUiContext = createContext<AgentUi>({
  open: false,
  setOpen: () => {},
  openSettings: () => {},
})

export const useAgentUi = () => useContext(AgentUiContext)
