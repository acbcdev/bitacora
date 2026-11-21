import { useState } from "react"
import { ChevronRight, CircleCheck, CircleX, Loader, Wrench } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/core/ui/collapsible"
import { cn } from "@/core/lib/utils"

// Una llamada a tool: nombre + estado, y al abrir los parámetros y el resultado. Sin resultado y
// con el Agente ocupado = ejecutando; sin resultado y ocioso (turno abortado) = sin estado.
export function ToolBlock({
  name,
  input,
  result,
  isError,
  busy,
}: {
  name: string
  input: unknown
  result?: string
  isError?: boolean
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-xs">
        <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono">{name}</span>
        {result !== undefined && isError ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-destructive">
            <CircleX className="size-3.5" /> Error
          </span>
        ) : result !== undefined ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-signal">
            <CircleCheck className="size-3.5" /> Completado
          </span>
        ) : busy ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
            <Loader className="size-3.5 animate-spin motion-reduce:animate-none" /> Ejecutando
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-150 ease-out",
            open && "rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 border-t p-3">
        <Block label="Parámetros">{JSON.stringify(input, null, 2)}</Block>
        {result !== undefined && (
          <Block label={isError ? "Error" : "Resultado"} error={isError}>
            {result}
          </Block>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

function Block({ label, children, error }: { label: string; children: string; error?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="mono-dim tracking-wide uppercase">{label}</span>
      <pre
        className={cn(
          "max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap",
          error && "text-destructive",
        )}
      >
        {children}
      </pre>
    </div>
  )
}
