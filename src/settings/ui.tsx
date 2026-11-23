import type { ReactNode } from "react"
import { cn } from "@/core/lib/utils"

// Piezas de página de Ajustes: Page (título + descripción), Group (sección con título y filas
// separadas por línea), Row (label a la izquierda, control a la derecha) y Block (contenido libre).
export function Page({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </header>
      {children}
    </div>
  )
}

export function Group({
  title,
  desc,
  children,
}: {
  title?: string
  desc?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      {(title || desc) && (
        <div>
          {title && <p className="eyebrow">{title}</p>}
          {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
        </div>
      )}
      <div className="flex flex-col divide-y border-y">{children}</div>
    </section>
  )
}

// `stack`: el control es ancho (grid de radios) y va debajo del label en vez de al lado.
export function Row({
  label,
  desc,
  stack,
  children,
}: {
  label: string
  desc?: string
  stack?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex gap-4 py-3.5",
        stack ? "flex-col" : "items-center justify-between max-sm:flex-col max-sm:items-stretch",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

export function Block({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("py-3.5", className)}>{children}</div>
}
