import { useEffect, useRef, useState } from "react"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/core/lib/utils"

// Reemplaza al PillCombobox de Base UI: sin portal ni vars runtime (--available-height /
// --anchor-width no se seteaban en el popup dentro del dialog → sin scroll y sin ancho).
// Dropdown `absolute` en el mismo árbol del modal: scroll con max-h estático, clicable sin
// parches de pointer-events, y abre con focus/click simples (ADR 0016).

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

// Texto sobre chip de fondo sólido: los amarillos/verdes claros piden texto oscuro, el resto
// blanco. YIQ aproximado — los 12 colores de DOT_COLORS caen bien con el umbral 160.
function chipText(color: string) {
  const n = parseInt(color.slice(1), 16)
  const yiq = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000
  return yiq >= 160 ? "#1c1917" : "#ffffff"
}

const PILL =
  "flex h-[34px] w-full min-w-0 items-center gap-1.5 rounded-full border bg-transparent pl-2.5 pr-1 transition-colors hover:border-border-strong hover:bg-accent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/10"

// Pill editable con sugerencias (estilo Notion): input libre (crea valores nuevos) + dropdown
// con las opciones ya usadas filtradas case-insensitive, como chips del color del valor.
// Sin portal — vive dentro del modal.
export function FieldPill({
  id,
  value,
  onChange,
  options,
  placeholder,
  icon,
  className,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
  icon: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const q = value.trim().toLowerCase()
  const matches = q ? options.filter((o) => o.toLowerCase().includes(q)) : options

  useEffect(() => setHighlight(0), [q, open])

  // Cerrar al click afuera: listener en document porque el click en otra parte del modal no
  // dispara blur útil (el input conserva el foco al clickar opciones).
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  // Escape con dropdown abierto cierra el dropdown y el modal queda. El DismissableLayer de
  // Radix (el Dialog) escucha keydown en capture en document y sólo respeta defaultPrevented;
  // en capture corre ANTES de llegar al input, así que ahí preventDefault llega tarde. Por eso
  // la intercepción vive en capture en window (antes del capture de document) y marca
  // defaultPrevented: Radix ve la marca y no cierra el modal. Sin dropdown, no hay listener
  // y el Escape fluye hasta el Dialog y lo cierra.
  useEffect(() => {
    if (!open) return
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && rootRef.current?.contains(e.target as Node)) {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onEscape, { capture: true })
    return () => window.removeEventListener("keydown", onEscape, { capture: true })
  }, [open])

  function pick(option: string) {
    onChange(option)
    setOpen(false)
  }

  // El highlight se mueve con ↓/↑ y la opción destacada scrollea a la vista (directo en el
  // handler: el elemento ya existe del render previo).
  function moveTo(next: number) {
    setHighlight(next)
    if (open) document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: "nearest" })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Escape lo maneja el capture de window (effect de arriba): acá no se toca.
    if (e.key === "Escape") return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = open ? Math.min(highlight + 1, matches.length - 1) : 0
      setOpen(true)
      if (matches.length > 0) moveTo(next)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      moveTo(Math.max(highlight - 1, 0))
    } else if (e.key === "Enter" && open && matches[highlight]) {
      // Enter sobre una opción la selecciona; Enter sin match no se toca → submittea el form
      // y el valor tipeado queda como fuente/área nueva.
      e.preventDefault()
      pick(matches[highlight])
    }
  }

  function clear(e: React.MouseEvent) {
    // El × vacía el valor sin robar el foco al input y deja el dropdown abierto para
    // elegir/crear otro (focus() explícito: el mousedown con preventDefault no lo mueve).
    e.preventDefault()
    onChange("")
    setOpen(true)
    document.getElementById(id)?.focus()
  }

  const hasValue = !!value.trim()
  const chip = dotColor(value.trim())
  const optionId = (i: number) => `${id}-option-${i}`

  return (
    // Con el dropdown abierto la raíz crea su propio stacking context: si no, el footer
    // (hermano posterior con background) pintaba encima del popup pese a su z-50.
    <div ref={rootRef} className={cn("relative min-w-0", open && "z-10", className)}>
      <div className={cn(PILL, hasValue && "border-border-strong")}>
        {/* Un solo <input> en los dos estados (chip o vacío): al vaciar el chip con × el nodo
            sobrevive, el foco queda en el input y el dropdown sigue abierto para elegir/crear. */}
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1",
            hasValue && "rounded-full py-[3px] pr-1 pl-2",
          )}
          style={hasValue ? { background: chip, color: chipText(chip) } : undefined}
        >
          {!hasValue && (
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
            aria-activedescendant={open && matches.length > 0 ? optionId(highlight) : undefined}
            autoComplete="off"
            className={cn(
              "bg-transparent text-[13.5px] font-medium outline-none placeholder:font-normal",
              hasValue
                ? // field-sizing-content: el chip abraza al texto. Sin soporte queda el ancho
                  // default del input — degradación aceptable.
                  "min-w-6 field-sizing-content"
                : "min-w-0 flex-1 truncate placeholder:font-normal",
            )}
          />
          {hasValue && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Vaciar ${placeholder.toLowerCase()}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={clear}
              className="shrink-0 rounded-full p-0.5 opacity-70 hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className="mr-1 size-3.5 shrink-0 text-muted-foreground opacity-60"
        />
      </div>

      {open && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 z-50 max-h-72 w-max min-w-full overflow-y-auto overscroll-contain rounded-xl bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {!q && (
            <li className="px-2 py-1.5 text-xs text-muted-foreground" aria-hidden>
              Selecciona o crea una opción
            </li>
          )}
          {matches.length === 0 ? (
            <li className="w-full py-2 text-center text-sm text-muted-foreground">
              Sin resultados
            </li>
          ) : (
            matches.map((option, i) => (
              <li key={option} role="none">
                <button
                  id={optionId(i)}
                  type="button"
                  role="option"
                  aria-selected={option === value.trim()}
                  // preventDefault evita que el mousedown le quite el foco al input.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(option)}
                  onPointerMove={() => setHighlight(i)}
                  className={cn(
                    "flex w-full items-center rounded-lg px-1.5 py-1 text-left text-sm whitespace-nowrap",
                    i === highlight && "bg-accent/50",
                  )}
                >
                  {/* Chip del color del valor; la destacada lleva ring. */}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[13px] font-medium",
                      i === highlight && "ring-2 ring-ring ring-offset-1",
                    )}
                    style={{ background: dotColor(option), color: chipText(dotColor(option)) }}
                  >
                    {option}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
