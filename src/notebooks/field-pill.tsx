import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/core/lib/utils"

// Reemplaza al PillCombobox de Base UI: sin portal ni vars runtime (--available-height /
// --anchor-width no se seteaban en el popup dentro del dialog → sin scroll y sin ancho).
// Dropdown `absolute` en el mismo árbol del modal: scroll con max-h estático, clicable sin
// parches de pointer-events, y abre con focus/click simples.

export const DOT_COLORS = [
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fbbf24",
  "#34d399",
  "#38bdf8",
  "#fb923c",
  "#ef4444",
  "#7ed321",
  "#f43f5e",
  "#9ca3af",
  "#14b8a6",
]

export function dotColor(value: string) {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return DOT_COLORS[h % DOT_COLORS.length]
}

const PILL =
  "flex h-[34px] w-full min-w-0 items-center gap-1.5 rounded-full border bg-transparent pl-2.5 pr-1 transition-colors hover:border-border-strong hover:bg-accent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/10"

const ValueDot = ({ value }: { value: string }) => (
  <span
    aria-hidden
    className="pointer-events-none size-[7px] shrink-0 rounded-full"
    style={{ background: dotColor(value) }}
  />
)

// Pill editable con sugerencias: input libre (crea valores nuevos) + dropdown con las
// opciones ya usadas filtradas case-insensitive. Sin portal — vive dentro del modal.
export function FieldPill({
  id,
  value,
  onChange,
  options,
  placeholder,
  icon,
  showDot,
  className,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
  icon: React.ReactNode
  showDot: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const q = value.trim().toLowerCase()
  const matches = q ? options.filter((o) => o.toLowerCase().includes(q)) : options

  useEffect(() => setHighlight(0), [q, open])

  // Cerrar al click afuera: listener en document porque el input está en el modal y el
  // click en otra parte no dispara blur util (el input conserva el foco al clickar opciones).
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  function pick(option: string) {
    onChange(option)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return setOpen(false)
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === "Enter" && open && matches[highlight]) {
      // Enter sobre una opción debe seleccionarla, no submittear el form.
      e.preventDefault()
      pick(matches[highlight])
    }
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <div
        className={cn(PILL, value.trim() && "border-border-strong bg-secondary hover:bg-secondary")}
      >
        {showDot && value.trim() ? (
          <ValueDot value={value.trim()} />
        ) : (
          <span className="pointer-events-none shrink-0 text-muted-foreground [&_svg]:size-3.5">
            {icon}
          </span>
        )}
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          autoComplete="off"
          className="min-w-0 flex-1 truncate bg-transparent text-[13.5px] font-medium outline-none placeholder:font-normal"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((o) => !o)}
          aria-label={`Mostrar sugerencias de ${placeholder.toLowerCase()}`}
          className="shrink-0 rounded-full p-1 text-muted-foreground opacity-60 hover:opacity-100"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      {open && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 z-50 max-h-72 w-max min-w-full overflow-y-auto overscroll-contain rounded-xl bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {matches.length === 0 ? (
            <li className="w-full py-2 text-center text-sm text-muted-foreground">
              Sin resultados
            </li>
          ) : (
            matches.map((option, i) => (
              <li key={option} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={option === value.trim()}
                  // preventDefault evita que el mousedown le quite el foco al input.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(option)}
                  onPointerMove={() => setHighlight(i)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm whitespace-nowrap",
                    i === highlight && "bg-accent text-accent-foreground",
                  )}
                >
                  <ValueDot value={option} />
                  {option}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
