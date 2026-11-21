import { useState } from "react"
import { Brain, ChevronRight } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/core/ui/collapsible"
import { cn } from "@/core/lib/utils"

// Razonamiento del modelo. Transmitiendo: abierto y con pulso ("Pensando…"). Terminado: cerrado,
// "Pensó durante N s", abre al click. El texto es salida del modelo: se pinta inerte (texto plano).
export function ReasoningBlock({
  streaming,
  ms,
  children,
}: {
  streaming?: boolean
  ms?: number
  children?: string
}) {
  const [open, setOpen] = useState(false)
  const secs = Math.max(1, Math.round((ms ?? 0) / 1000))
  const label = streaming ? "Pensando…" : ms === undefined ? "Pensó" : `Pensó durante ${secs} s`
  return (
    <Collapsible
      open={streaming ? true : open}
      onOpenChange={setOpen}
      className="flex flex-col gap-1.5"
    >
      <CollapsibleTrigger
        disabled={streaming || !children}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:pointer-events-none"
      >
        <Brain className="size-3.5" />
        <span className={cn(streaming && "animate-pulse motion-reduce:animate-none")}>{label}</span>
        {!streaming && children && (
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform duration-150 ease-out",
              open && "rotate-90",
            )}
          />
        )}
      </CollapsibleTrigger>
      {children && (
        <CollapsibleContent>
          <p className="border-l pl-3 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {children}
          </p>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}
