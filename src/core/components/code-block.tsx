import { useState } from "react"
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { CheckIcon, CopyIcon, DownloadIcon, WrapTextIcon } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select"

// ponytail: solo los lenguajes comunes; el resto cae a .txt
const EXTENSIONS: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  python: "py",
  bash: "sh",
  shell: "sh",
  markdown: "md",
  rust: "rs",
  ruby: "rb",
  kotlin: "kt",
  csharp: "cs",
  yaml: "yml",
  plaintext: "txt",
  text: "txt",
}

// Node view del code block: header con el lenguaje (select nativo, opciones = las que registró
// lowlight) y botón de copiar. contentEditable={false} para que ProseMirror no lo trate como
// contenido.
export function CodeBlockView({ node, extension, editor, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  // Wrap es preferencia de vista, no del documento: estado local, no atributo del nodo.
  const [wrap, setWrap] = useState(false)
  // Las notas importadas traen alias ("js", "sh") o lenguajes fuera de `common`: si el actual no
  // está en la lista, el select quedaría vacío. Se agrega para que se vea el que tiene.
  const current = (node.attrs.language as string | null) ?? "text"
  const registered = [
    "text",
    ...(extension.options.lowlight.listLanguages() as string[]).toSorted(),
  ]
  const languages = registered.includes(current) ? registered : [current, ...registered]

  function copy() {
    navigator.clipboard.writeText(node.textContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function download() {
    const url = URL.createObjectURL(new Blob([node.textContent], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `code.${EXTENSIONS[current] ?? current}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <NodeViewWrapper className="relative py-1">
      <div
        contentEditable={false}
        className="absolute inset-x-2.5 top-2.5 flex items-center justify-between"
      >
        <Select
          value={current}
          disabled={!editor.isEditable}
          onValueChange={(lang) => updateAttributes({ language: lang === "text" ? null : lang })}
        >
          <SelectTrigger
            size="sm"
            aria-label="Lenguaje del bloque"
            className="-ml-1.5 h-6 border-transparent px-1.5 font-mono text-xs text-fg-secondary capitalize hover:bg-muted disabled:opacity-100 dark:bg-transparent dark:hover:bg-muted"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-64">
            {languages.map((lang) => (
              <SelectItem key={lang} value={lang} className="font-mono text-xs capitalize">
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Ajustar líneas"
            aria-pressed={wrap}
            className="aria-pressed:bg-muted"
            onClick={() => setWrap(!wrap)}
          >
            <WrapTextIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Descargar código" onClick={download}>
            <DownloadIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Copiar código" onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
      </div>
      <pre className={wrap ? "whitespace-pre-wrap break-words" : undefined}>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
