import { useState } from "react"
import { cn } from "@/core/lib/utils"

const STATES = {
  error: { label: "falló", className: "text-destructive" },
  done: { label: "completado", className: "text-signal" },
  running: { label: "ejecutando…", className: "shimmer" },
}

// Una llamada a tool, como una línea de texto: nombre + estado. Al abrir, los parámetros en una
// línea y el resultado. Sin resultado y con el Agente ocupado = ejecutando; sin resultado y
// ocioso (turno abortado) = sin estado.
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
  const state =
    result === undefined ? (busy ? STATES.running : null) : STATES[isError ? "error" : "done"]
  const params = Object.entries((input ?? {}) as object)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(" · ")
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-fit cursor-pointer items-baseline gap-2 text-left text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <span className="font-mono text-xs">{name}</span>
        {state && <span className={cn("text-xs", state.className)}>{state.label}</span>}
      </button>
      {open && (
        <div className="fade-in flex flex-col gap-1 border-l pl-3 font-mono text-xs">
          {params && <span className="break-words text-muted-foreground">{params}</span>}
          {result !== undefined && (
            <pre
              className={cn(
                "max-h-40 overflow-auto break-words whitespace-pre-wrap",
                isError && "text-destructive",
              )}
            >
              {result}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
