import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { Ref } from "react"
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react"
import type { Content } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { createLowlight, common } from "lowlight"
import { Fragment, Slice } from "@tiptap/pm/model"
import { sinkListItem, liftListItem } from "@tiptap/pm/schema-list"
import { toast } from "sonner"
import { store } from "@/core/store"
import type { TiptapDoc } from "@/core/types/database"
import { markdownToDoc } from "@/core/lib/tiptap-markdown"
import { CodeBlockView } from "@/core/components/code-block"
import { ImageView } from "@/core/components/image-view"
import { Outline } from "@/core/components/outline"
import { EditorLightbox } from "@/core/components/editor-lightbox"
import { collectImages, type LightboxImage } from "@/core/components/editor-lightbox-utils"

const lowlight = createLowlight(common)

const CodeBlock = CodeBlockLowlight.extend({
  addNodeView: () => ReactNodeViewRenderer(CodeBlockView),
}).configure({ lowlight })

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const w = element.getAttribute("width")
          if (w) return Number.parseInt(w, 10) || null
          const styleW = element.style.width
          if (styleW) return Number.parseInt(styleW, 10) || null
          return null
        },
        renderHTML: (attributes: { width: number | null }) => {
          if (!attributes.width) return {}
          return { width: String(attributes.width), style: `width: ${attributes.width}px` }
        },
      },
      // height solo para CLS: se persiste en onLoad y permite reservar aspect-ratio
      // antes de que la imagen decodifique en la próxima visita.
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const h = element.getAttribute("height")
          if (h) return Number.parseInt(h, 10) || null
          return null
        },
        renderHTML: (attributes: { height: number | null }) => {
          if (!attributes.height) return {}
          return { height: String(attributes.height) }
        },
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})

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
  const host = useRef<HTMLDivElement>(null)
  // Señal de rescaneo para el Outline: sube en cada cambio de contenido.
  const [version, setVersion] = useState(0)
  const [lbOpen, setLbOpen] = useState(false)
  const [lbIndex, setLbIndex] = useState(0)
  const [lbImages, setLbImages] = useState<LightboxImage[]>([])
  const lbOpenRef = useRef(lbOpen)
  useEffect(() => {
    lbOpenRef.current = lbOpen
  }, [lbOpen])

  const openLightboxRef = useRef<(src: string, alt?: string, docOverride?: TiptapDoc) => void>(
    () => {},
  )

  const editor = useEditor({
    // Tablas (spec .scratch/editor-tables): solo render + edición de texto de celdas. resizable
    // false = sin handles ni columnGroup attrs; no hay toolbar de tabla — el contenido entra por
    // paste Markdown o import Notion.
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlock,
      ResizableImage,
      // Scroll horizontal (story 3): la clase va en el tag table via HTMLAttributes — sin wrapper
      // DOM extra. td/th/padding/borders viven en index.css (.tiptap-host .ProseMirror th/td).
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: "my-4 block w-max max-w-full overflow-x-auto border-collapse text-sm",
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
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
        // Imagen en el portapapeles (screenshot copiado, o archivo copiado del finder):
        // sube al store y lo inserta. Sin esto, pegar imagen era un silencio total —
        // `raw` venía vacío y caía al default de ProseMirror, que no hace nada.
        const image = event.clipboardData?.items
          ? [...event.clipboardData.items].find((i) => i.type.startsWith("image/"))
          : null
        if (image) {
          const file = image.getAsFile()
          if (file) {
            event.preventDefault()
            const node = view.state.schema.nodes.image
            toast.promise(
              store.uploadNoteImage(file).then((src) => {
                view.dispatch(
                  view.state.tr.replaceSelection(
                    new Slice(Fragment.from(node.create({ src })), 0, 0),
                  ),
                )
              }),
              {
                loading: "Subiendo imagen…",
                success: "Imagen insertada",
                error: (e) => (e instanceof Error ? e.message : "No se pudo subir la imagen"),
              },
            )
            return true
          }
        }

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
      handleClickOn(_view, _pos, node) {
        if (node.type.name === "image") {
          const src = (node.attrs as { src?: string }).src
          const alt = (node.attrs as { alt?: string }).alt
          if (src) {
            // view.state.doc contiene la doc fresca al momento del click
            const docJSON = _view.state.doc.toJSON() as TiptapDoc
            openLightboxRef.current(src, alt, docJSON)
            return true
          }
        }
        return false
      },
      // Un solo Esc saca el foco del editor.
      handleKeyDown(view, event) {
        if (lbOpenRef.current) return false
        if (event.key !== "Escape") return false

        view.dom.blur()
        return true
      },
      // Tab/Shift-Tab siempre capturados: hunden/suben el ítem de lista y fuera de una lista
      // no hacen nada — pero NUNCA dejan que el browser mueva el foco fuera del editor.
      handleDOMEvents: {
        keydown(view, event) {
          if (event.key !== "Tab") return false
          event.preventDefault()
          // En lista: anida/saca el ítem. Si no aplica (primer ítem, fuera de lista), Tab
          // inserta indentación — antes era un no-op total.
          const itemType = view.state.schema.nodes.listItem
          if (itemType) {
            const sunk = event.shiftKey
              ? liftListItem(itemType)(view.state, view.dispatch)
              : sinkListItem(itemType)(view.state, view.dispatch)
            if (sunk) return true
          }
          const { $from } = view.state.selection
          if (event.shiftKey) {
            // Borra hasta 4 espacios pegados al cursor (el indent que insertó Tab).
            const before = $from.parent.textBetween(
              Math.max(0, $from.parentOffset - 4),
              $from.parentOffset,
            )
            const n = / +$/.exec(before)?.[0].length ?? 0
            if (n) view.dispatch(view.state.tr.delete($from.pos - n, $from.pos))
          } else {
            view.dispatch(view.state.tr.insertText("    "))
          }
          return true
        },
      },
    },
  })

  const openLightbox = useCallback(
    (src: string, alt?: string, docOverride?: TiptapDoc) => {
      const currentDoc = docOverride ?? (editor?.getJSON() as TiptapDoc | undefined) ?? content
      const imgs = collectImages(currentDoc)
      if (imgs.length === 0) {
        if (!src) return
        setLbImages([{ src, alt }])
        setLbIndex(0)
        setLbOpen(true)
        return
      }
      let idx = imgs.findIndex((i) => i.src === src)
      if (idx < 0) idx = 0
      setLbImages(imgs)
      setLbIndex(idx)
      setLbOpen(true)
    },
    [editor, content],
  )
  useEffect(() => {
    openLightboxRef.current = openLightbox
  }, [openLightbox])

  // Delegación DOM: click en <img> dentro de ProseMirror abre lightbox.
  // Complementa handleClickOn: en jsdom handleClickOn no siempre dispara con fireEvent,
  // y además cubre imágenes renderizadas fuera de la gestión de ProseMirror (fallback).
  useEffect(() => {
    const el = host.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const img = target?.closest("img") as HTMLImageElement | null
      if (!img || !el.contains(img)) return
      if (!img.closest(".ProseMirror")) return
      const src = img.getAttribute("src")
      if (!src) return
      const alt = img.getAttribute("alt") ?? undefined
      e.preventDefault()
      openLightboxRef.current(src, alt)
    }
    el.addEventListener("click", handler)
    return () => el.removeEventListener("click", handler)
  }, [])

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable)
  }, [editor, editable])

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
      <EditorLightbox
        images={lbImages}
        index={lbIndex}
        open={lbOpen}
        onOpenChange={setLbOpen}
        onIndexChange={setLbIndex}
      />
    </div>
  )
}
