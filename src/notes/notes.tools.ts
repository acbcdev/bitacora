import { asData } from "@/core/agent/prompt"
import type { AgentTool } from "@/core/agent/tool"
import { noteRefs, notebookNotes } from "@/core/store/derive"
import { docToMarkdown, markdownToDoc } from "@/core/lib/tiptap-markdown"
import type { NoteInput, NoteRef } from "@/core/store/types"

const MAX_LIST = 200
const DEFAULT_LIMIT = 50
// ponytail: tope de cuerpos leídos por búsqueda (cada uno es un `view.note`, 1 fetch en Supabase).
// Si hace falta más, un `store.notes(ids)` en bulk.
const BODY_SCAN = 300

const ref = (n: NoteRef, fragmento?: string) =>
  asData(
    "nota",
    { id: n.id, titulo: n.title || "(sin título)", notebook_id: n.notebook_id },
    fragmento,
  )

const pagingProps = {
  limit: {
    type: "number",
    description: `Máx. por página (default ${DEFAULT_LIMIT}, tope ${MAX_LIST})`,
  },
  offset: { type: "number", description: "Cuántos saltear (paginación)" },
}

// Ventana [offset, offset+limit) + cabecera que dice cuánto hay y cómo pedir lo que falta.
function page<T>(label: string, items: T[], args: Record<string, unknown>, fmt: (t: T) => string) {
  const limit = Math.min(Math.max(Number(args.limit) || DEFAULT_LIMIT, 1), MAX_LIST)
  const offset = Math.max(Number(args.offset) || 0, 0)
  const slice = items.slice(offset, offset + limit)
  const next = offset + slice.length
  const more = next < items.length ? `\n(+${items.length - next} más: offset=${next})` : ""
  return [`${label}: ${items.length}`, ...slice.map(fmt)].join("\n") + more
}

// ~100 chars alrededor del primer match, en una línea.
function snippet(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q)
  return text
    .slice(Math.max(0, i - 40), i + q.length + 60)
    .replace(/\s+/g, " ")
    .trim()
}

// `read_note` devuelve la nota ENTERA (sin truncar): es lo que hace seguro el reemplazo total de
// `update_note` más adelante. El modelo ve Markdown, nunca el TiptapDoc.
export const notesTools: AgentTool[] = [
  {
    name: "list_notes",
    description:
      "Lista notas (solo títulos, sin cuerpo), en el orden del notebook. Con notebook_id lista las de ese notebook; sin él, todas. Paginable con limit/offset.",
    schema: {
      type: "object",
      properties: { notebook_id: { type: "string" }, ...pagingProps },
      additionalProperties: false,
    },
    risk: "read",
    async run(args, { view }) {
      const snap = await view.snapshot()
      const id = args.notebook_id as string | undefined
      return page("Notas", id ? notebookNotes(snap, id) : noteRefs(snap), args, (n) => ref(n))
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
      "Busca notas cuyo TÍTULO o CUERPO contenga el texto (sin distinguir mayúsculas). Las coincidencias en cuerpo traen un fragmento. Filtrá con notebook_id para buscar más rápido; paginable con limit/offset.",
    schema: {
      type: "object",
      properties: { query: { type: "string" }, notebook_id: { type: "string" }, ...pagingProps },
      required: ["query"],
      additionalProperties: false,
    },
    risk: "read",
    async run(args, { view }) {
      const q = (args.query as string).toLowerCase()
      const id = args.notebook_id as string | undefined
      const snap = await view.snapshot()
      const pool = id ? notebookNotes(snap, id) : noteRefs(snap)
      const byTitle = (n: NoteRef) => n.title.toLowerCase().includes(q)
      const rest = pool.filter((n) => !byTitle(n))
      const scanned = rest.slice(0, BODY_SCAN)
      const bodies = await Promise.all(
        scanned.map(async (n) => docToMarkdown((await view.note(n.id)).content)),
      )
      const hitIds = new Set(pool.filter(byTitle).map((n) => n.id))
      const frag = new Map<string, string>()
      scanned.forEach((n, i) => {
        if (!bodies[i].toLowerCase().includes(q)) return
        hitIds.add(n.id)
        frag.set(n.id, snippet(bodies[i], q))
      })
      const hits = pool.filter((n) => hitIds.has(n.id))
      const cut =
        rest.length > BODY_SCAN
          ? `\n(cuerpo escaneado en ${BODY_SCAN} de ${rest.length} notas: pasá notebook_id para acotar)`
          : ""
      return page("Coincidencias", hits, args, (n) => ref(n, frag.get(n.id))) + cut
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
