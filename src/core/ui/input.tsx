import * as React from "react"

import { cn } from "@/core/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // DS: fondo bg-surface + borde border-default, sin relleno tintado.
        // Las flechitas nativas de `type=number` no se usan nunca: hay un −/+ propio al lado o
        // el campo se tipea. Va acá y no en cada consumidor — es el default de la app.
        "h-8 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 py-1 text-base transition-shadow outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
