// Forma local de nodo Tiptap para el import. Independiente de src/ (el script no es feature de
// la app, ver spec .scratch/notion-import).
export type TiptapMark = { type: string; attrs?: Record<string, unknown> }

export type TiptapNode = {
  type: string
  content?: TiptapNode[]
  text?: string
  marks?: TiptapMark[]
  attrs?: Record<string, unknown>
}

export type TiptapDoc = { type: "doc"; content: TiptapNode[] }
