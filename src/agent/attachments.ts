import type { Attachment } from "@/core/agent/attachments"
import { docToMarkdown } from "@/core/lib/tiptap-markdown"
import { habitState, notebookNotes } from "@/core/store/derive"
import type { Store } from "@/core/store/types"

export type AttachRef = { kind: "nota" | "notebook" | "habito"; id: string }

// Referencia → contenido COMPLETO de ese turno (no un puntero): nota, notebook con todas sus
// notas, o hábito con su estado.
export async function resolveRef(
  store: Store,
  r: AttachRef,
  now = new Date(),
): Promise<Attachment> {
  if (r.kind === "nota") {
    const n = await store.note(r.id)
    return {
      kind: "text",
      tag: "nota",
      attrs: { id: n.id, titulo: n.title || "(sin título)" },
      body: docToMarkdown(n.content),
    }
  }
  const snap = await store.snapshot()
  if (r.kind === "notebook") {
    const nb = snap.notebooks.find((x) => x.id === r.id)
    const notes = await Promise.all(notebookNotes(snap, r.id).map((n) => store.note(n.id)))
    return {
      kind: "text",
      tag: "notebook",
      attrs: { id: r.id, nombre: nb?.name ?? "" },
      body: notes
        .map((n) => `# ${n.title || "(sin título)"}\n\n${docToMarkdown(n.content)}`)
        .join("\n\n"),
    }
  }
  const h = snap.habits.find((x) => x.id === r.id)
  const s = habitState(snap, r.id, now)
  return {
    kind: "text",
    tag: "habito",
    attrs: {
      id: r.id,
      nombre: h?.name ?? "",
      tipo: h?.kind ?? null,
      metrica: h?.metric ?? null,
      meta: h?.target ?? null,
      periodo: h?.period ?? null,
      hoy: s?.today ?? 0,
      racha: s?.streak ?? 0,
      cumple: s?.met ? "si" : "no",
    },
    body: "",
  }
}

const TEXT_EXT =
  /\.(md|txt|csv|json|ya?ml|toml|xml|html?|css|[cm]?[jt]sx?|py|rb|go|rs|java|kt|swift|c|h|cpp|sh|sql)$/i

// PDF y binarios quedan fuera: solo texto plano / código.
export const isTextFile = (f: File) => f.type.startsWith("text/") || TEXT_EXT.test(f.name)

export async function readFile(f: File): Promise<Attachment> {
  if (f.type.startsWith("image/")) {
    const data = await new Promise<string>((ok, fail) => {
      const r = new FileReader()
      r.addEventListener("load", () => ok((r.result as string).split(",")[1] ?? ""))
      r.addEventListener("error", () => fail(r.error))
      r.readAsDataURL(f)
    })
    return { kind: "image", name: f.name, mediaType: f.type, data }
  }
  if (!isTextFile(f))
    throw new Error(`"${f.name}": solo acepto imágenes y archivos de texto (PDF no).`)
  return {
    kind: "text",
    tag: "archivo",
    attrs: { nombre: f.name },
    body: await f.text(),
  }
}
