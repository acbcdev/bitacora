import { useState } from "react"
import { ChevronLeft, ChevronRight, Moon, Play, Sun } from "lucide-react"
import { Button } from "@/core/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/core/ui/toggle-group"
import { cn } from "@/core/lib/utils"
import { getSound, playDoneSound, setSound, SOUNDS, type SoundId } from "@/habits/sound"

// Escalas en index.css ([data-radius]). Smooth = default = la Forma D original. La escala se
// repite acá para dibujar la esquina real de cada opción (24px × escala).
export const RADII = [
  ["sharp", "Sharp", 0],
  ["slight", "Slight", 0.3],
  ["medium", "Medium", 0.6],
  ["smooth", "Smooth", 1],
  ["curved", "Curved", 1.5],
] as const

// Claro | Oscuro muestra el estado actual (el botón anterior mostraba el opuesto).
export function ThemeSegment({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <ToggleGroup
      type="single"
      value={dark ? "dark" : "light"}
      onValueChange={(v) => v && (v === "dark") !== dark && onToggle()}
      className="sm:w-56"
      aria-label="Tema"
    >
      <ToggleGroupItem value="light" className="flex-1">
        <Sun />
        Claro
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" className="flex-1">
        <Moon />
        Oscuro
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export function RadiusPicker() {
  const [radius, setRadius] = useState(() => document.documentElement.dataset.radius ?? "smooth")

  function pick(next: string) {
    document.documentElement.dataset.radius = next
    localStorage.setItem("bita-radius", next)
    setRadius(next)
  }

  return (
    <section>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {RADII.map(([id, label, scale]) => (
          <button
            key={id}
            type="button"
            aria-pressed={radius === id}
            onClick={() => pick(id)}
            className={cn(
              "flex flex-col gap-2 rounded-lg p-2 text-left ring-1 ring-foreground/10 transition-shadow",
              radius === id && "ring-2 ring-foreground",
            )}
          >
            <span className="flex h-14 items-start justify-start rounded-md bg-muted p-2">
              <span
                className="size-10 border-t-2 border-l-2 border-foreground"
                style={{ borderTopLeftRadius: 24 * scale }}
              />
            </span>
            <span className="px-1 text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// Stepper: ‹ nombre › + play. Cambiar de sonido lo reproduce, así que el play es para repetirlo
// sin mover la selección.
export function SoundPicker() {
  const ids = Object.keys(SOUNDS) as SoundId[]
  const [sound, setCurrent] = useState(getSound)

  function step(d: number) {
    const next = ids[(ids.indexOf(sound) + d + ids.length) % ids.length]
    setSound(next)
    setCurrent(next)
    playDoneSound(true)
  }

  return (
    <div>
      <div className="flex items-center gap-1 rounded-pill bg-secondary px-3 py-1">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-pill"
          aria-label="Anterior"
          onClick={() => step(-1)}
        >
          <ChevronLeft />
        </Button>
        {/* key remonta el span: la animación de entrada corre en cada cambio */}
        <output className="block min-w-24 overflow-hidden text-center text-sm font-medium">
          <span key={sound} className="block animate-in fade-in slide-in-from-bottom-2">
            {SOUNDS[sound].label}
          </span>
        </output>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-pill"
          aria-label="Siguiente"
          onClick={() => step(1)}
        >
          <ChevronRight />
        </Button>
        <Button
          size="icon"
          className="rounded-pill"
          aria-label="Probar"
          onClick={() => playDoneSound(true)}
        >
          <Play className="fill-current" />
        </Button>
      </div>
    </div>
  )
}
