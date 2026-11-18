import { useState } from "react"
import {
  AlertTriangle,
  Cloud,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  Moon,
  Play,
  Sun,
} from "lucide-react"
import { Button } from "@/core/ui/button"
import { Drialog, DrialogContent, DrialogHeader, DrialogTitle } from "@/core/ui/drialog"
import { ToggleGroup, ToggleGroupItem } from "@/core/ui/toggle-group"
import { hasSupabaseEnv } from "@/core/lib/supabase"
import { store } from "@/core/store"
import { setStorageMode } from "@/core/store/mode"
import { cn } from "@/core/lib/utils"
import type { StorageMode } from "@/core/store/types"
import { getSound, playDoneSound, setSound, SOUNDS, type SoundId } from "@/habits/sound"
import { ReadGoalForm } from "@/review/read-goal-form"

// Ajustes como Drialog y no como ruta: un overlay no reabre "solo 3 pantallas" (ui-principles),
// mismo criterio que el dialog de hábitos. CONTEXT.md ya dejaba escrita esta dirección.
//
// Contenido: lo que hay, no lo que podría haber. Tema (que antes vivía sólo en el menú del
// sidebar), sonido, meta de lectura y dónde se guardan los datos.

const MODES: {
  mode: StorageMode
  icon: typeof Cloud
  title: string
  detail: string
}[] = [
  {
    mode: "supabase",
    icon: Cloud,
    title: "Supabase",
    detail: "Postgres + auth. Los datos te siguen entre dispositivos.",
  },
  {
    mode: "local",
    icon: HardDrive,
    title: "Este navegador",
    detail: "Sin cuenta, sin red. Todo vive en localStorage de este navegador.",
  },
]

// Escalas en index.css ([data-radius]). Smooth = default = la Forma D original. La escala se
// repite acá para dibujar la esquina real de cada opción (24px × escala).
const RADII = [
  ["sharp", "Sharp", 0],
  ["slight", "Slight", 0.3],
  ["medium", "Medium", 0.6],
  ["smooth", "Smooth", 1],
  ["curved", "Curved", 1.5],
] as const

// Claro | Oscuro muestra el estado actual (el botón anterior mostraba el opuesto).
function ThemeSegment({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const item = "flex-1 data-[state=on]:bg-background data-[state=on]:shadow-sm"
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      value={dark ? "dark" : "light"}
      onValueChange={(v) => v && (v === "dark") !== dark && onToggle()}
      className="bg-muted p-0.5 sm:w-56"
      aria-label="Tema"
    >
      <ToggleGroupItem value="light" className={item}>
        <Sun />
        Claro
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" className={item}>
        <Moon />
        Oscuro
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

function RadiusPicker() {
  const [radius, setRadius] = useState(() => document.documentElement.dataset.radius ?? "smooth")

  function pick(next: string) {
    document.documentElement.dataset.radius = next
    localStorage.setItem("bita-radius", next)
    setRadius(next)
  }

  return (
    <section>
      <p className="text-sm font-medium">Radio de borde</p>
      <p className="text-sm text-muted-foreground">
        Qué tan redondeadas son las cards, inputs y menús.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
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
function SoundPicker() {
  const ids = Object.keys(SOUNDS) as SoundId[]
  const [sound, setCurrent] = useState(getSound)

  function step(d: number) {
    const next = ids[(ids.indexOf(sound) + d + ids.length) % ids.length]
    setSound(next)
    setCurrent(next)
    playDoneSound()
  }

  return (
    <section className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Sonido de hábitos</p>
        <p className="text-sm text-muted-foreground">Suena al completar tu meta de tiempo.</p>
      </div>
      <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
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
          className="rounded-full"
          aria-label="Siguiente"
          onClick={() => step(1)}
        >
          <ChevronRight />
        </Button>
        <Button
          size="icon"
          className="rounded-full"
          aria-label="Probar"
          onClick={() => playDoneSound()}
        >
          <Play className="fill-current" />
        </Button>
      </div>
    </section>
  )
}

export function Settings({
  onClose,
  dark,
  onToggleTheme,
}: {
  onClose: () => void
  dark: boolean
  onToggleTheme: () => void
}) {
  return (
    <Drialog open onOpenChange={(next) => !next && onClose()}>
      {/* Mismo tamaño que el NoteDialog en desktop. El padding extra y la X más adentro son por
          Curved: su esquina (36px) se comía el título con el padding de 16px. */}
      <DrialogContent className="flex flex-col md:h-[85vh] md:w-5xl md:max-w-5xl md:p-8 md:**:data-[slot=dialog-close]:top-5 md:**:data-[slot=dialog-close]:right-5">
        <DrialogHeader>
          <DrialogTitle className="text-lg font-semibold">Ajustes</DrialogTitle>
        </DrialogHeader>

        {/* Sin esto, en una pantalla baja el último modo queda abajo del corte y no se puede
            elegir. Las dos mitades del Drawer acotan distinto: el Drawer es flex-col con
            max-h-90vh (gobierna `flex-1 min-h-0` + max-md:max-h-70vh), y el Dialog tiene alto
            fijo (md:h-85vh) y scrollea acá adentro. En desktop el contenido va a ancho de lectura. */}
        <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-1 pb-2 max-md:max-h-[70vh] md:mx-auto md:w-full md:max-w-2xl">
          <section className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
            <div>
              <p className="text-sm font-medium">Tema</p>
              <p className="text-sm text-muted-foreground">Se guarda en este navegador.</p>
            </div>
            <ThemeSegment dark={dark} onToggle={onToggleTheme} />
          </section>

          <RadiusPicker />

          <SoundPicker />

          <section className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
            <div>
              <p className="text-sm font-medium">Meta de lectura</p>
              <p className="text-sm text-muted-foreground">
                Notas por día. La racha 🔥 cuenta los días que llegás.
              </p>
            </div>
            <ReadGoalForm />
          </section>

          <section>
            <p className="text-sm font-medium">Dónde se guardan los datos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Los dos modos son excluyentes: no hay sync entre ellos. Cambiar recarga la app.
            </p>

            <div className="mt-4 flex flex-col gap-1">
              {MODES.map(({ mode, icon: Icon, title, detail }) => {
                const current = store.mode === mode
                // Sin env de Supabase no hay a qué volver: el modo remoto queda deshabilitado en
                // vez de escondido, así se ve QUE existe y por qué no está disponible.
                const disabled = mode === "supabase" && !hasSupabaseEnv
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={current || disabled}
                    onClick={() => setStorageMode(mode)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg p-3 text-left transition-colors",
                      current ? "bg-muted" : "hover:bg-accent",
                      disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                    )}
                  >
                    <Icon className="mt-0.5 shrink-0" />
                    <span className="flex flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {title}
                        {current && <span className="mono-dim">actual</span>}
                      </span>
                      <span className="text-sm text-muted-foreground">{detail}</span>
                      {disabled && (
                        <span className="text-sm text-muted-foreground">
                          Falta configurar <code>VITE_SUPABASE_URL</code> en <code>.env</code>.
                        </span>
                      )}
                    </span>
                    {/* Punto tipo radio: el estado actual se lee sin depender del color de fondo. */}
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                        current ? "border-foreground" : "border-border-strong/40",
                      )}
                    >
                      {current && <span className="size-2 rounded-full bg-foreground" />}
                    </span>
                  </button>
                )
              })}
            </div>

            {store.mode === "local" && (
              <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 shrink-0" />
                Borrar los datos del navegador borra las notas. No hay copia en ningún lado.
              </p>
            )}
          </section>
        </div>
      </DrialogContent>
    </Drialog>
  )
}
