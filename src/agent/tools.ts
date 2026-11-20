import type { AgentTool } from "@/core/agent/tool"
import { habitsTools } from "@/habits/habits.tools"
import { notebooksTools } from "@/notebooks/notebooks.tools"
import { notesTools } from "@/notes/notes.tools"

// Único lugar que conoce a los módulos de dominio: imports estáticos, sin registry global ni
// side-effects de import. Un módulo nuevo = una línea acá.
export const agentTools: AgentTool[] = [...notebooksTools, ...notesTools, ...habitsTools]
