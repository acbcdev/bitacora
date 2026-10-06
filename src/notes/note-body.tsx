import { useEffect, useRef, type ReactElement } from "react"
import { Editor } from "@/core/components/editor"
import type { EditorHandle } from "@/core/components/editor"
import { useTypeToFocus } from "@/notes/use-type-to-focus"
import type { useNoteDraft } from "@/notes/notes.api"

// Cuerpo editable de una nota: título + editor + el pegamento (paste smart, paste global,
// type-to-focus). Lo comparten NoteEditor y NoteDialog (ADR 0021): solo cambia el chrome.
// `titleWrap` deja al diálogo envolver el textarea en su DialogTitle (título accesible de Radix).
export function NoteBody({
  draft,
  large = false,
  titleSize = "text-4xl",
  titleWrap = (el) => el,
}: {
  draft: ReturnType<typeof useNoteDraft>
  large?: boolean
  titleSize?: string
  titleWrap?: (title: ReactElement) => ReactElement
}) {
  const { note, title, onTitleChange, onDocChange, flush } = draft
  const editorRef = useRef<EditorHandle>(null)

  // Regla v2 (ADR 0017): las letras escriben. Con el editor desenfocado, un keydown de letra a-z
  // enfoca el editor y la letra entra — sin excepciones (ni F).
  useTypeToFocus(editorRef)

  // Paste "smart" tipo Notion (notes/05): con el título vacío, pegar un bloque multilínea
  // -sea en el título o en el body- manda la 1ra línea al título y el resto al body.
  // Título ya tiene texto: paste normal, sin magia.
  function splitTitleFromPaste(text: string): { first: string; rest: string } | null {
    if (title.trim() !== "" || !text.includes("\n")) return null
    const [first, ...rest] = text.split("\n")
    return { first: first.trim(), rest: rest.join("\n").trim() }
  }

  function onTitlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const split = splitTitleFromPaste(e.clipboardData.getData("text/plain"))
    if (!split) return

    e.preventDefault()
    onTitleChange(split.first)
    if (split.rest) editorRef.current?.insertMarkdownAtStart(split.rest)
  }

  // Prop genérica onPaste del Editor: se llama cuando el paste cae directo en el body.
  function onPaste(text: string): string {
    const split = splitTitleFromPaste(text)
    if (!split) return text
    onTitleChange(split.first)
    return split.rest
  }

  // Cmd+V en cualquier parte de la página (nada enfocado, click en el chrome, etc), no solo
  // adentro del título o el editor: título vacío -> título/body como arriba; título con texto
  // -> todo el paste al body. El evento "paste" nativo burbujea a document igual, por eso se
  // ignora acá si ya lo agarró el textarea o el editor (tienen su propio onPaste).
  useEffect(() => {
    function onGlobalPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest("textarea, .tiptap-host")) return
      const text = e.clipboardData?.getData("text/plain")
      if (!text) return

      e.preventDefault()
      if (title.trim() !== "") {
        editorRef.current?.insertMarkdownAtStart(text)
        return
      }
      const [first, ...rest] = text.split("\n")
      onTitleChange(first.trim())
      const body = rest.join("\n").trim()
      if (body) editorRef.current?.insertMarkdownAtStart(body)
    }

    document.addEventListener("paste", onGlobalPaste)
    return () => document.removeEventListener("paste", onGlobalPaste)
  }, [title, onTitleChange])

  if (!note) return null

  return (
    <>
      {/* ponytail: textarea + field-sizing:content para que el título wrapee y crezca solo.
          Un <input> no wrapea y los títulos largos se cortaban. Sin JS de auto-resize.
          border-b separa título/cuerpo (se confundían visualmente). */}
      <div className="mb-6 border-b pb-4">
        {titleWrap(
          <textarea
            rows={1}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onPaste={onTitlePaste}
            onBlur={flush}
            aria-label="Título"
            placeholder="Título"
            className={`field-sizing-content w-full resize-none bg-transparent ${titleSize} font-semibold tracking-tighter text-pretty outline-none placeholder:text-muted-foreground`}
          />,
        )}
      </div>
      {/* flex-1 llena el resto del viewport: el footer de shortcuts queda pegado abajo en vez
          de pegado al final del contenido. onClick: clickear la zona vacía debajo del texto
          pone el cursor al final (como Notion/Docs), no se queda "muerta". key: el Editor solo
          lee `content` al montar, así que remonta por nota. */}
      <div
        data-size={large ? "lg" : undefined}
        className="flex-1 cursor-text"
        onClick={(e) => {
          if (e.target === e.currentTarget) editorRef.current?.focusEnd()
        }}
      >
        <Editor
          key={note.id}
          ref={editorRef}
          content={note.content}
          onChange={onDocChange}
          onPaste={onPaste}
        />
      </div>
    </>
  )
}
