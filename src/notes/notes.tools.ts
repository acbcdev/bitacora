import { asData } from "@/core/agent/prompt"
import type { AgentTool } from "@/core/agent/tool"
import { noteRefs, notebookNotes } from "@/core/store/derive"
import { docToMarkdown, markdownToDoc } from "@/core/lib/tiptap-markdown"
import type { NoteInput, NoteRef } from "@/core/store/types"

const MAX_LIST = 200

const ref = (n: NoteRef) =>
  asData("nota", {
    id: n.id,
    titulo: n.title || "(sin título)",
    notebook_id: n.notebook_id,
  })

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
        {
          id: note.id,
          titulo: note.title || "(sin título)",
          notebook_id: note.notebook_id,
        },
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
  {
    name: "create_note",
    description:
      "Propone crear una nota con cuerpo en Markdown, opcionalmente dentro de un notebook (notebook_id). Devuelve su id.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "Cuerpo en Markdown" },
        notebook_id: { type: "string" },
      },
      required: ["title"],
      additionalProperties: false,
    },
    risk: "safe",
    async plan(args, { view }) {
      const snap = await view.snapshot()
      const nbId = (args.notebook_id as string | undefined) ?? null
      if (nbId && !snap.notebooks.some((n) => n.id === nbId))
        throw new Error(`No existe el notebook ${nbId}`)
      const after: NoteInput = {
        id: crypto.randomUUID(),
        title: args.title as string,
        content: markdownToDoc((args.content as string | undefined) ?? ""),
        notebook_id: nbId,
        position: nbId ? notebookNotes(snap, nbId).length : 0,
      }
      return {
        entity: "notes",
        label: `Crear nota «${after.title}» (id ${after.id})`,
        before: null,
        after,
      }
    },
  },
  {
    name: "update_note",
    description:
      "Propone editar una nota. `content` REEMPLAZA el cuerpo entero (Markdown): leé la nota con read_note y devolvé el texto completo con tu cambio. Solo se tocan los campos que pasás.",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    risk: "unsafe",
    async plan(args, { view }) {
      const note = await view.note(args.id as string)
      const after: NoteInput = { id: note.id }
      const before: NoteInput = { id: note.id }
      if (args.title !== undefined) {
        after.title = args.title as string
        before.title = note.title
      }
      if (args.content !== undefined) {
        after.content = markdownToDoc(args.content as string)
        before.content = note.content
      }
      return {
        entity: "notes",
        label: `Editar nota «${note.title || "(sin título)"}»`,
        before,
        after,
      }
    },
  },
]
