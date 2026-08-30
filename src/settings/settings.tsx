import { AlertTriangle, Cloud, HardDrive, Moon, Sun, Volume2 } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Drialog, DrialogContent, DrialogHeader, DrialogTitle } from "@/core/ui/drialog"
import { hasSupabaseEnv } from "@/core/lib/supabase"
import { store } from "@/core/store"
import { setStorageMode } from "@/core/store/mode"
import { cn } from "@/core/lib/utils"
import type { StorageMode } from "@/core/store/types"
import { playDoneSound } from "@/habits/habit-timer"

// Ajustes como Drialog y no como ruta: un overlay no reabre "solo 3 pantallas" (ui-principles),
// mismo criterio que el dialog de hábitos. CONTEXT.md ya dejaba escrita esta dirección.
//
// Contenido: lo que hay, no lo que podría haber. Tema (que antes vivía sólo en el menú del
// sidebar) y dónde se guardan los datos. Cuando haya un tercer ajuste real, entra acá.

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

export function Settings({
  onClose,
  dark,
  onToggleTheme,
}: {
  onClose: () => void
  dark: boolean
  onToggleTheme: () => void
}) {
  const ThemeIcon = dark ? Sun : Moon

  return (
    <Drialog open onOpenChange={(next) => !next && onClose()}>
      <DrialogContent className="md:w-140 md:max-w-140">
        <DrialogHeader>
          <DrialogTitle className="text-lg font-semibold">Ajustes</DrialogTitle>
        </DrialogHeader>

        {/* Sin esto, en una pantalla baja el último modo queda abajo del corte y no se puede
            elegir. Las dos mitades del Drialog acotan distinto y por eso van las dos reglas:
            el Drawer es flex-col con max-h-80vh (gobierna `flex-1 min-h-0`), y el Dialog es un
            grid que crece con el contenido (gobierna `max-h-[70vh]`). */}
        <div className="flex max-h-[70vh] min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-1 pb-2">
          <section className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Tema</p>
              <p className="text-sm text-muted-foreground">
                {dark ? "Oscuro" : "Claro"} — se guarda en este navegador.
              </p>
            </div>
            <Button variant="outline" onClick={onToggleTheme}>
              <ThemeIcon />
              {dark ? "Claro" : "Oscuro"}
            </Button>
          </section>

          <section className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Sonido de hábitos</p>
              <p className="text-sm text-muted-foreground">Beep al completar tu meta de tiempo.</p>
            </div>
            <Button variant="outline" onClick={() => playDoneSound()}>
              <Volume2 />
              Probar
            </Button>
          </section>

          <section>
            <p className="text-sm font-medium">Dónde se guardan los datos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Los dos modos son excluyentes: no hay sync entre ellos. Cambiar recarga la app.
            </p>

            <div className="mt-4 flex flex-col gap-2">
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
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      current ? "border-brand bg-brand/5" : "hover:bg-accent",
                      disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                    )}
                  >
                    <Icon className="mt-0.5 shrink-0" />
                    <span className="flex flex-col gap-0.5">
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
