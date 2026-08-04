import {
  Atom,
  Book,
  Brain,
  Briefcase,
  Calculator,
  Camera,
  Code,
  Compass,
  Cpu,
  Database,
  Dna,
  Dumbbell,
  Film,
  FlaskConical,
  Gamepad2,
  Globe,
  GraduationCap,
  Headphones,
  Landmark,
  Languages,
  Leaf,
  Lightbulb,
  Mic,
  Microscope,
  Music,
  Newspaper,
  Palette,
  Pencil,
  PenTool,
  Plane,
  Presentation,
  Puzzle,
  Rocket,
  Scale,
  Shield,
  Stethoscope,
  Terminal,
  TrendingUp,
  Trophy,
  Users,
  Video,
  Wrench,
} from "lucide-react"
import { cn } from "@/core/lib/utils"

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
  Atom,
  Dna,
  PenTool,
  GraduationCap,
  Rocket,
  Wrench,
  Dumbbell,
  Film,
  Gamepad2,
  Scale,
  Microscope,
  Stethoscope,
  Landmark,
  TrendingUp,
  Briefcase,
  Leaf,
  Mic,
  Puzzle,
  Compass,
  Users,
  Pencil,
  Video,
  Newspaper,
  Plane,
  Trophy,
  Lightbulb,
  Presentation,
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
  // Emoji: la mayoría de los íconos de página de Notion lo son (import de notion-import).
  if (icon) return <span className={cn("size-4 shrink-0 text-center", className)}>{icon}</span>
  return null
}
