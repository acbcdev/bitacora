import { useState } from "react"
import { Button } from "@/core/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/core/ui/toggle-group"
import { RadiusPicker, ThemeSegment } from "@/settings/controls"
import { Block, Group, Page, Row } from "@/settings/ui"

// Vista previa: usa los mismos tokens que la app, así que tema y radio se ven reflejados al instante.
function Preview() {
  return (
    <div className="rounded-xl bg-background p-6 ring-1 ring-foreground/10">
      <div className="mx-auto max-w-lg">
        <p className="eyebrow">Clase 12 · JavaScript</p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight">Closures</h3>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          Una closure es una función que recuerda el scope donde nació, aunque ese scope ya haya
          terminado de ejecutarse.
        </p>
        <div className="mt-3 rounded-lg bg-muted p-3 font-mono text-sm">
          const next = makeCounter()
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm">Marcar leída</Button>
          <Button size="sm" variant="outline">
            Saltar
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AppearancePage({
  dark,
  onToggleTheme,
}: {
  dark: boolean
  onToggleTheme: () => void
}) {
  // "bita-sb" = "1" colapsado; app.tsx lo lee al arrancar.
  const [sb, setSb] = useState(() => localStorage.getItem("bita-sb") ?? "0")
  return (
    <Page title="Apariencia" desc="Cómo se ve la app. Los cambios se aplican al instante.">
      <Group title="Vista previa">
        <Block>
          <Preview />
        </Block>
      </Group>
      <Group title="Tema">
        <Row label="Modo" desc="Se guarda en este navegador.">
          <ThemeSegment dark={dark} onToggle={onToggleTheme} />
        </Row>
        <Row label="Radio de borde" desc="Qué tan redondeadas son las cards, inputs y menús." stack>
          <RadiusPicker />
        </Row>
      </Group>
      <Group title="Interfaz">
        <Row label="Sidebar al abrir" desc="Estado inicial; ⌘B lo alterna igual.">
          <ToggleGroup
            type="single"
            value={sb}
            onValueChange={(v) => {
              if (!v) return
              localStorage.setItem("bita-sb", v)
              setSb(v)
            }}
            aria-label="Sidebar al abrir"
          >
            <ToggleGroupItem value="0">Abierto</ToggleGroupItem>
            <ToggleGroupItem value="1">Colapsado</ToggleGroupItem>
          </ToggleGroup>
        </Row>
      </Group>
    </Page>
  )
}
