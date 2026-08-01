import { useEffect, useImperativeHandle } from "react"
import type { Ref } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import type { Content } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Fragment, Slice } from "@tiptap/pm/model"
import type { TiptapDoc } from "@/core/types/database"
import { markdownToDoc } from "@/core/lib/tiptap-markdown"

export type EditorHandle = {
  // Paste "smart" del título (notes/05): el resto del texto pegado entra al cuerpo, arriba de todo.
  insertMarkdownAtStart: (text: string) => void
  // Click en la zona vacía debajo del contenido (notes/07): pone el cursor al final, como en
  // Notion/Docs, en vez de no hacer nada.
  focusEnd: () => void
}

// Editor Tiptap (notes/01). StarterKit = headings, bold/italic/strike/code, listas, codeBlock,
// blockquote, hr. WYSIWYG, MIT, sin Tiptap Cloud. content se guarda/recarga como JSON (notes.content).
export function Editor({
  content,
  editable = true,
  onChange,
  onPaste,
  ref,
}: {
  content: TiptapDoc
  editable?: boolean
  onChange?: (doc: TiptapDoc) => void
  // Preprocesa el texto pegado antes del parseo Markdown (notes/05: le da la 1ra línea al
  // título si estaba vacío). Devuelve el texto que efectivamente se inserta en el body.
  onPaste?: (text: string) => string
  ref?: Ref<EditorHandle>
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content as Content,
    editable,
    onUpdate: ({ editor: updated }) => onChange?.(updated.getJSON() as TiptapDoc),
    editorProps: {
      // Pega texto plano con sintaxis Markdown (**bold**, # heading, - lista...) como nodos
      // formateados en vez de texto literal. Si el portapapeles trae HTML (paste rico), no toca nada.
      handlePaste(view, event) {
        const raw = event.clipboardData?.getData("text/plain")
        const html = event.clipboardData?.getData("text/html")
        if (!raw || html) return false

        const text = onPaste ? onPaste(raw) : raw
        if (!text.trim()) return true

        const doc = markdownToDoc(text)
        const nodes = (doc.content ?? []).map((n) => view.state.schema.nodeFromJSON(n))
        const slice = new Slice(Fragment.from(nodes), 0, 0)
        view.dispatch(view.state.tr.replaceSelection(slice))
        return true
      },
    },
  })

  // Modo lectura (Repaso): si cambia la nota mostrada, refrescar el contenido.
  useEffect(() => {
    if (editor && !editable) editor.commands.setContent(content as Content)
  }, [editor, editable, content])

  useImperativeHandle(
    ref,
    () => ({
      insertMarkdownAtStart(text: string) {
        const nodes = markdownToDoc(text).content
        if (editor && nodes?.length)
          editor
            .chain()
            .insertContentAt(0, nodes as Content)
            .run()
      },
      focusEnd() {
        editor?.chain().focus("end").run()
      },
    }),
    [editor],
  )

  return <EditorContent editor={editor} className="tiptap-host" />
}
