import {
  Book,
  Brain,
  Calculator,
  Camera,
  Code,
  Cpu,
  Database,
  FlaskConical,
  Globe,
  Headphones,
  Languages,
  Music,
  Palette,
  Shield,
  Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"

// El mapa acota qué presets existen: lo que no está acá no se puede elegir ni dibujar.
export const PRESET_ICONS = {
  Book,
  Code,
  Terminal,
  Database,
  Brain,
  Cpu,
  Globe,
  Palette,
  Shield,
  FlaskConical,
  Calculator,
  Languages,
  Music,
  Headphones,
  Camera,
}

export type PresetIcon = keyof typeof PRESET_ICONS

// `courses.icon` es 'lucide:<Nombre>' o la URL pública de una imagen subida (ver migración 0004).
export function CourseIcon({ icon, className }: { icon: string | null; className?: string }) {
  if (icon?.startsWith("lucide:")) {
    // `hasOwn` y no un lookup pelado: 'lucide:constructor' devolvería Object.prototype.constructor.
    const name = icon.slice(7)
    if (!Object.hasOwn(PRESET_ICONS, name)) return null
    const Preset = PRESET_ICONS[name as PresetIcon]
    return <Preset className={cn("size-4 shrink-0", className)} />
  }
  if (icon?.startsWith("http")) {
    return (
      <img src={icon} alt="" className={cn("size-4 shrink-0 rounded-sm object-cover", className)} />
    )
  }
  return null
}
