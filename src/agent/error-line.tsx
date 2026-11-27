import { useState } from "react"
import { cn } from "@/core/lib/utils"

// Error crudo del Proveedor → frase que dice qué hacer. El crudo sigue a un click ("Detalle"):
// el usuario necesita verlo tal cual (401, CORS, red). Heurística por regex: lo que no reconoce
// cae en el genérico.
export function describeError(raw: string): string {
  if (/401|authentication|invalid.*key|api[-_ ]?key/i.test(raw))
    return "La key del Proveedor no es válida. Revisala en Ajustes."
  if (/429|rate.?limit|quota|overloaded/i.test(raw))
    return "El Proveedor está limitando las llamadas. Esperá un momento y reintentá."
  if (/failed to fetch|econnrefused|network|cors/i.test(raw))
    return "No se pudo conectar con el Proveedor. ¿Está corriendo el servidor?"
  return "El Proveedor devolvió un error."
}

const link =
  "w-fit cursor-pointer text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"

// Error o corte del turno, solo texto: qué pasó, una acción opcional y el detalle crudo.
// `info` = no es un error (límite de pasos, detenido): color neutro.
export function ErrorLine({
  title,
  detail,
  action,
  onAction,
  info,
}: {
  title: string
  detail?: string
  action?: string
  onAction?: () => void
  info?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div role={info ? "status" : "alert"} className="fade-in flex flex-col gap-1.5">
      <p className={cn("text-sm break-words", info ? "text-muted-foreground" : "text-destructive")}>
        {title}
      </p>
      {(action || detail) && (
        <div className="flex gap-3">
          {action && (
            <button type="button" onClick={onAction} className={cn(link, "text-foreground")}>
              {action}
            </button>
          )}
          {detail && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className={link}
            >
              Detalle
            </button>
          )}
        </div>
      )}
      {open && detail && (
        <pre className="fade-in max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-xs break-words whitespace-pre-wrap text-destructive">
          {detail}
        </pre>
      )}
    </div>
  )
}
