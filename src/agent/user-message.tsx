import { useState } from "react"
import { cn } from "@/core/lib/utils"

// Mensaje del usuario como título del turno: cerrado = máx. 2 líneas; el click lo despliega.
export function UserMessage({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      className={cn(
        "w-full cursor-pointer text-left text-lg leading-snug whitespace-pre-wrap",
        !open && "line-clamp-2",
      )}
    >
      {children}
    </button>
  )
}
