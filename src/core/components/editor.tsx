import { useEffect } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import type { Content } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import type { TiptapDoc } from "@/core/types/database"

// Editor Tiptap (notes/01). StarterKit = headings, bold/italic/strike/code, listas, codeBlock,
// blockquote, hr. WYSIWYG, MIT, sin Tiptap Cloud. content se guarda/recarga como JSON (notes.content).
export function Editor({
  content,
  editable = true,
  onChange,
}: {
  content: TiptapDoc
  editable?: boolean
  onChange?: (doc: TiptapDoc) => void
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content as Content,
    editable,
    onUpdate: ({ editor: updated }) => onChange?.(updated.getJSON() as TiptapDoc),
  })

  // Modo lectura (Repaso): si cambia la nota mostrada, refrescar el contenido.
  useEffect(() => {
    if (editor && !editable) editor.commands.setContent(content as Content)
  }, [editor, editable, content])

  return <EditorContent editor={editor} className="tiptap-host" />
}
