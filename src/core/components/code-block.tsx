import { useState } from "react"
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { BracesIcon, CheckIcon, CopyIcon, DownloadIcon, WrapTextIcon } from "lucide-react"
import { toast } from "sonner"
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

// Lenguaje (nombres de lowlight + alias de notas importadas) → parser de prettier y sus plugins.
// Lazy: prettier y cada parser bajan al primer click en formatear, no con la nota.
const estree = () => import("prettier/plugins/estree")
const babel = () => import("prettier/plugins/babel")
const postcss = () => import("prettier/plugins/postcss")
const html = () => import("prettier/plugins/html")
const markdown = () => import("prettier/plugins/markdown")
const yaml = () => import("prettier/plugins/yaml")
const ts = () => import("prettier/plugins/typescript")
const graphql = () => import("prettier/plugins/graphql")
const PARSERS: Record<string, [string, ...(() => Promise<object>)[]]> = {
  javascript: ["babel", babel, estree],
  js: ["babel", babel, estree],
  jsx: ["babel", babel, estree],
  typescript: ["typescript", ts, estree],
  ts: ["typescript", ts, estree],
  tsx: ["typescript", ts, estree],
  json: ["json", babel, estree],
  css: ["css", postcss],
  scss: ["scss", postcss],
  less: ["less", postcss],
  html: ["html", html],
  xml: ["html", html],
  markdown: ["markdown", markdown],
  md: ["markdown", markdown],
  yaml: ["yaml", yaml],
  yml: ["yaml", yaml],
  graphql: ["graphql", graphql],
}

// Node view del code block: header con el lenguaje (select nativo, opciones = las que registró
// lowlight) y botón de copiar. contentEditable={false} para que ProseMirror no lo trate como
// contenido.
export function CodeBlockView({
  node,
  extension,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) {
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

  async function format() {
    const [parser, ...loaders] = PARSERS[current]!
    try {
      const [prettier, ...plugins] = await Promise.all([
        import("prettier/standalone"),
        ...loaders.map((load) => load()),
      ])
      const code = (await prettier.format(node.textContent, { parser, plugins })).trimEnd()
      const pos = getPos()
      if (pos === undefined || code === node.textContent) return
      // Reemplaza el nodo ENTERO (no solo su texto): el plugin de lowlight solo re-resalta si un
      // step cubre el bloque completo o el cursor está dentro, y al hacer click el cursor está
      // afuera. Una sola transacción: Cmd+Z deshace el formateo entero.
      const block = node.type.create(node.attrs, editor.schema.text(code))
      editor.view.dispatch(editor.state.tr.replaceWith(pos, pos + node.nodeSize, block))
    } catch {
      toast.error("No se pudo formatear: revisa la sintaxis")
    }
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
          {PARSERS[current] && editor.isEditable && (
            <Button variant="ghost" size="icon-xs" aria-label="Formatear código" onClick={format}>
              <BracesIcon />
            </Button>
          )}
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
