import { useState } from "react"
import { Brain, ChevronRight } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/core/ui/collapsible"
import { cn } from "@/core/lib/utils"

// Razonamiento del modelo (llega con el turno terminado; generateText no transmite): cerrado,
// "Pensó durante N s", abre al click. El texto es salida del modelo: se pinta inerte (texto plano).
export function ReasoningBlock({ ms, children }: { ms?: number; children?: string }) {
  const [open, setOpen] = useState(false)
  const secs = Math.max(1, Math.round((ms ?? 0) / 1000))
  const label = ms === undefined ? "Pensó" : `Pensó durante ${secs} s`
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-1.5">
      <CollapsibleTrigger
        disabled={!children}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:pointer-events-none"
      >
        <Brain className="size-3.5" />
        <span>{label}</span>
        {children && (
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
