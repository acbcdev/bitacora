import { useEffect, useImperativeHandle, useRef, useState } from "react"
import type { Ref } from "react"
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react"
import type { Content } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { createLowlight, common } from "lowlight"
import { Fragment, Slice } from "@tiptap/pm/model"
import type { TiptapDoc } from "@/core/types/database"
import { markdownToDoc } from "@/core/lib/tiptap-markdown"
import { CodeBlockView } from "@/core/components/code-block"
import { Outline } from "@/core/components/outline"

const lowlight = createLowlight(common)

const CodeBlock = CodeBlockLowlight.extend({
  addNodeView: () => ReactNodeViewRenderer(CodeBlockView),
}).configure({ lowlight })

export type EditorHandle = {
  // Paste "smart" del título (notes/05): el resto del texto pegado entra al cuerpo, arriba de todo.
  insertMarkdownAtStart: (text: string) => void
  // Click en la zona vacía debajo del contenido (notes/07): pone el cursor al final, como en
  // Notion/Docs, en vez de no hacer nada.
  focusEnd: () => void
}

// Editor Tiptap (notes/01). StarterKit = headings, bold/italic/strike/code, listas, codeBlock,
// blockquote, hr. WYSIWYG, MIT, sin Tiptap Cloud. content se guarda/recarga como JSON (notes.content).
// Image: solo lectura de nodos existentes (notas importadas de Notion) — no hay upload desde la app.
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
  const lastEscape = useRef(0)
  const host = useRef<HTMLDivElement>(null)
  // Señal de rescaneo para el Outline: sube en cada cambio de contenido.
  const [version, setVersion] = useState(0)
  const editor = useEditor({
    extensions: [StarterKit.configure({ codeBlock: false }), CodeBlock, Image],
    content: content as Content,
    editable,
    onUpdate: ({ editor: updated }) => {
      setVersion((v) => v + 1)
      onChange?.(updated.getJSON() as TiptapDoc)
    },
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
      // Doble Esc (dentro de 500ms) saca el foco del editor. El primero se deja pasar para que
      // siga cerrando lo que haya abierto encima (select del code block, dialog, focus mode).
      handleKeyDown(view, event) {
        if (event.key !== "Escape") return false

        const double = Date.now() - lastEscape.current < 500
        lastEscape.current = double ? 0 : Date.now()
        if (!double) return false

        view.dom.blur()
        return true
      },
    },
  })

  // Modo lectura (Repaso): si cambia la nota mostrada, refrescar el contenido. setContent no
  // dispara onUpdate, así que el rescaneo del Outline se avisa a mano.
  useEffect(() => {
    if (editor && !editable) {
      editor.commands.setContent(content as Content)
      setVersion((v) => v + 1)
    }
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

  // El Outline va fuera del contenteditable (adentro de .ProseMirror sería contenido editable del
  // documento) y primero en el flujo, que es lo que necesita su sticky. Ver ADR 0007.
  return (
    <div ref={host} className="relative">
      <Outline host={host} version={version} />
      <EditorContent editor={editor} className="tiptap-host" />
    </div>
  )
}
