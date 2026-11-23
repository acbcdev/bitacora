import { ToggleGroup, ToggleGroupItem } from "@/core/ui/toggle-group"

// Toggle de vista (grid / lista) con solo íconos. Wrapper del ToggleGroup: el `v &&` evita que
// Radix lo deje vacío al re-clickear el activo (elección exclusiva, nunca vacía).
export function ViewPill<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  // { valor: icono } — el orden de las keys es el orden visual.
  options: Record<T, React.ReactNode>
  className?: string
}) {
  return (
    <ToggleGroup
      type="single"
      aria-label="vista"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      className={className}
    >
      {(Object.entries(options) as [T, React.ReactNode][]).map(([v, icon]) => (
        <ToggleGroupItem key={v} value={v} aria-label={v} className="w-8 px-0">
          {icon}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
