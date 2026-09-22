import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
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
// opciones ya usadas filtradas case-insensitive, cada una con su dot de color. Sin portal —
// vive dentro del modal.
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
  // Búsqueda interna, separada del valor confirmado (value): mientras se tipea, el input
  // muestra y filtra por esto; confirmar (elegir/crear) la limpia. Nunca es un valor a mostrar:
  // cerrar sin confirmar (Escape) la descarta, confirmar la manda a value.
  const [search, setSearch] = useState<string | null>(null)
  const editing = search !== null
  const shown = editing ? search : value
  // Sin edición activa la lista muestra todas las opciones: el filtro es de la búsqueda, no del valor.
  const q = (editing ? search : "").trim().toLowerCase()
  const matches = q ? options.filter((o) => o.toLowerCase().includes(q)) : options

  useEffect(() => setHighlight(0), [q, open])

  // Confirmar la búsqueda pendiente como valor (crear) vive inline en el effect de abajo:
  // ahí es el único uso, leyendo `search` directo (deps completos, sin ref).

  // Cerrar al click afuera: listener en document porque el click en otra parte del modal no
  // dispara blur útil (el input conserva el foco al clickar opciones). Lo tipeado se confirma:
  // click en "Guardar"/otro pill no borra lo escrito.
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      const v = search?.trim()
      if (v) onChange(v)
      setSearch(null)
      setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open, search, onChange])

  // Escape con dropdown abierto cierra el dropdown y el modal queda, descartando la búsqueda
  // (el valor confirmado no se toca).
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
        setSearch(null)
      }
    }
    window.addEventListener("keydown", onEscape, { capture: true })
    return () => window.removeEventListener("keydown", onEscape, { capture: true })
  }, [open])

  function pick(option: string) {
    onChange(option)
    setSearch(null)
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
      // Enter sobre una opción la selecciona; Enter sin match (o dropdown cerrado) no se toca
      // → submittea el form. Confirmar la búsqueda como valor nuevo es parte del pick.
      e.preventDefault()
      pick(matches[highlight])
    } else if (e.key === "Enter" && open && editing && shown.trim()) {
      // Crear desde cero: la búsqueda pasa a ser el valor y el form submittea (el valor tipeado
      // llega al payload). Sin preventDefault para no bloquear el submit nativo.
      onChange(shown.trim())
      setSearch(null)
    }
  }

  const hasValue = !!value.trim()
  const optionId = (i: number) => `${id}-option-${i}`

  return (
    // Con el dropdown abierto la raíz crea su propio stacking context: si no, el footer
    // (hermano posterior con background) pintaba encima del popup pese a su z-50.
    <div ref={rootRef} className={cn("relative min-w-0", open && "z-10", className)}>
      <div className={cn(PILL, hasValue && "border-border-strong bg-secondary hover:bg-secondary")}>
        {/* Un solo <input> en los dos estados: muestra el valor confirmado o la búsqueda en curso. */}
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <span className="pointer-events-none shrink-0 text-muted-foreground [&_svg]:size-3.5">
            {icon}
          </span>
          <input
            id={id}
            value={shown}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={editing ? placeholder : hasValue ? undefined : placeholder}
            aria-label={placeholder}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-listbox`}
            aria-activedescendant={open && matches.length > 0 ? optionId(highlight) : undefined}
            autoComplete="off"
            className="min-w-0 flex-1 truncate bg-transparent text-[13.5px] font-medium outline-none placeholder:font-normal"
          />
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
            q ? (
              // Búsqueda sin matches: ofrecer crear el valor nuevo (el Enter ya lo hace).
              <li role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(shown.trim())
                    setSearch(null)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm whitespace-nowrap"
                >
                  <span
                    aria-hidden
                    className="size-[7px] shrink-0 rounded-full"
                    style={{ background: dotColor(shown.trim()) }}
                  />
                  Crear “{shown.trim()}”
                </button>
              </li>
            ) : (
              <li className="w-full py-2 text-center text-sm text-muted-foreground">
                Sin resultados
              </li>
            )
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
                    "flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm whitespace-nowrap",
                    i === highlight && "bg-accent text-accent-foreground",
                  )}
                >
                  {/* El dot de color es la identidad del valor; sólo vive en la lista. */}
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
