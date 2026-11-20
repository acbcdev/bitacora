import { asData } from "@/core/agent/prompt"
import type { AgentTool } from "@/core/agent/tool"
import { noteRefs, notebookNotes } from "@/core/store/derive"
import { docToMarkdown } from "@/core/lib/tiptap-markdown"
import type { NoteRef } from "@/core/store/types"

const MAX_LIST = 200

const ref = (n: NoteRef) =>
  asData("nota", { id: n.id, titulo: n.title || "(sin título)", notebook_id: n.notebook_id })

// `read_note` devuelve la nota ENTERA (sin truncar): es lo que hace seguro el reemplazo total de
// `update_note` más adelante. El modelo ve Markdown, nunca el TiptapDoc.
export const notesTools: AgentTool[] = [
  {
    name: "list_notes",
    description: `Lista notas (solo títulos, sin cuerpo), en el orden del notebook. Con notebook_id lista las de ese notebook; sin él, todas. Máximo ${MAX_LIST}.`,
    schema: {
      type: "object",
      properties: { notebook_id: { type: "string" } },
      additionalProperties: false,
    },
    risk: "read",
    async run(args, { view }) {
      const snap = await view.snapshot()
      const id = args.notebook_id as string | undefined
      const notes = id ? notebookNotes(snap, id) : noteRefs(snap)
      const more =
        notes.length > MAX_LIST ? `\n(+${notes.length - MAX_LIST} más: usá search_notes)` : ""
      return [`Notas: ${notes.length}`, ...notes.slice(0, MAX_LIST).map(ref)].join("\n") + more
    },
  },
  {
    name: "read_note",
    description: "Lee una nota completa por id: título y cuerpo en Markdown.",
    schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    risk: "read",
    async run(args, { view }) {
      const note = await view.note(args.id as string)
      return asData(
        "nota",
        { id: note.id, titulo: note.title || "(sin título)", notebook_id: note.notebook_id },
        docToMarkdown(note.content),
      )
    },
  },
  {
    name: "search_notes",
    description:
      "Busca notas cuyo TÍTULO contenga el texto (no busca en el cuerpo). Para el cuerpo usá read_note.",
    schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
    risk: "read",
    async run(args, { view }) {
      const q = (args.query as string).toLowerCase()
      const hits = noteRefs(await view.snapshot()).filter((n) => n.title.toLowerCase().includes(q))
      return [`Coincidencias: ${hits.length}`, ...hits.slice(0, MAX_LIST).map(ref)].join("\n")
    },
  },
]
