import { useState } from "react"
import { cn } from "@/core/lib/utils"

// Razonamiento del modelo, solo texto: cerrado, "Pensó durante N s"; abre al click. El texto es
// salida del modelo: se pinta inerte (texto plano).
export function ReasoningBlock({
  ms,
  live,
  children,
}: {
  ms?: number
  // Llegando por stream: abierto y con "Pensando…"; al cerrar el paso lo reemplaza el bloque final.
  live?: boolean
  children?: string
}) {
  const [open, setOpen] = useState(!!live)
  const secs = Math.max(1, Math.round((ms ?? 0) / 1000))
  const label = live ? "Pensando…" : ms === undefined ? "Pensó" : `Pensó durante ${secs} s`
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-expanded={open}
        disabled={!children}
        onClick={() => setOpen((o) => !o)}
        className="w-fit cursor-pointer text-left text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:pointer-events-none"
      >
        <span className={cn(live && "shimmer")}>{label}</span>
      </button>
      {open && children && (
        <p className="fade-in border-l pl-3 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {children}
        </p>
      )}
    </div>
  )
}
