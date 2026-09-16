import { BookOpen, type LucideIcon } from "lucide-react"
import { cn } from "@/core/lib/utils"
import { PRESET_ICONS, type PresetIcon } from "./preset-icons"

// Tintes preset para los íconos lucide (IconPicker): pocos, no custom — así la clase queda
// explícita en el código y Tailwind la genera siempre. El ícono lo guarda como
// 'lucide:<Nombre>|<clase>' (NotebookIcon la valida antes de aplicar).
export const ICON_TINTS = [
  "text-red-500",
  "text-orange-500",
  "text-amber-500",
  "text-green-500",
  "text-sky-500",
  "text-violet-500",
  "text-pink-500",
] as const

// Mismo orden que ICON_TINTS: bg-* para mostrar el color como dot en el picker.
export const TINT_DOTS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-green-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-pink-500",
] as const

const TINT_SET = new Set<string>(ICON_TINTS)

// `notebooks.icon` es 'lucide:<Nombre>' con tinte opcional ('lucide:<Nombre>|text-red-500'),
// la URL pública de una imagen subida, o un emoji (ver migración 0004).
// `fallback` es el icono de "sin icono": BookOpen para un notebook, otro para un hábito (donde un
// libro no significa nada).
export function NotebookIcon({
  icon,
  className,
  fallback: Fallback = BookOpen,
}: {
  icon: string | null
  className?: string
  fallback?: LucideIcon
}) {
  if (icon?.startsWith("lucide:")) {
    // `hasOwn` y no un lookup pelado: 'lucide:constructor' devolvería Object.prototype.constructor.
    const [name, tint] = icon.slice(7).split("|")
    if (!Object.hasOwn(PRESET_ICONS, name)) return null
    const Preset = PRESET_ICONS[name as PresetIcon]
    return <Preset className={cn("size-4 shrink-0", TINT_SET.has(tint) && tint, className)} />
  }
  if (icon?.startsWith("http")) {
    return (
      <img src={icon} alt="" className={cn("size-4 shrink-0 rounded-sm object-cover", className)} />
    )
  }
  // Emoji: la mayoría de los íconos de página de Notion lo son (import de notion-import).
  if (icon) return <span className={cn("size-4 shrink-0 text-center", className)}>{icon}</span>
  return <Fallback className={cn("size-4 shrink-0", className)} />
}
