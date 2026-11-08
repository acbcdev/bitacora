// Toggle de vista (grid / lista) con el look de chip de los toolbars: bg-card + ring, el activo
// relleno muted. Radiogroup a mano y no radix ToggleGroup: el look es otro y la semántica
// (elección exclusiva, nunca vacía) ya la da un radio.
export function ViewPill<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T
  onChange: (v: T) => void
  // { valor: icono } — el orden de las keys es el orden visual.
  options: Record<T, React.ReactNode>
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label="vista"
      className={`flex h-8 items-center gap-0.5 rounded-full bg-card px-1 shadow-card ring-1 ring-border ${className}`}
    >
      {(Object.entries(options) as [T, React.ReactNode][]).map(([v, icon]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-label={v}
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`flex h-6 w-8 cursor-pointer items-center justify-center rounded-full [&_svg]:size-3.5 ${
            value === v ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}
