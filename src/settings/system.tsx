import { useEffect, useState } from "react"
import { Kbd } from "@/core/ui/kbd"
import { GROUPS } from "@/core/components/cheatsheet"
import { Group, Page, Row } from "@/settings/ui"

export function ShortcutsPage() {
  return (
    <Page
      title="Atajos de teclado"
      desc="Las letras escriben, mod+ manda. Ver docs/ui-principles.md."
    >
      <div className="gap-x-10 sm:columns-2">
        {GROUPS.map(([group, items]) => (
          <div key={group} className="break-inside-avoid pb-7">
            <p className="eyebrow mb-3">{group}</p>
            <div className="flex flex-col gap-2.5">
              {items.map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <Kbd>{key}</Kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Page>
  )
}

// ───────── Acerca ─────────
export function AboutPage() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])
  const standalone = matchMedia("(display-mode: standalone)").matches
  return (
    <Page title="Acerca de" desc="Estado de la app y qué sale de tu navegador.">
      <Group title="App">
        <Row label="Instalación">
          <span className="mono-dim">{standalone ? "PWA instalada" : "En el navegador"}</span>
        </Row>
        <Row
          label="Almacenamiento persistente"
          desc="Si el navegador lo concede, no borra tus datos locales por falta de espacio."
        >
          <span className="mono-dim">{persisted === null ? "—" : persisted ? "sí" : "no"}</span>
        </Row>
        <Row label="Entorno">
          <span className="mono-dim">{import.meta.env.MODE}</span>
        </Row>
      </Group>
      <Group title="Privacidad" desc="Terceros que reciben datos. Nada más sale de acá.">
        <Row label="Sentry" desc="Solo errores. Sin Replay, sin datos personales." />
        <Row label="Cloudflare Web Analytics" desc="Métricas de rendimiento. Sin cookies." />
        <Row
          label="Proveedor del Agente"
          desc="Recibe tus prompts y las notas que el Agente lea, con tu key. Bitácora no paga ni ve esos tokens."
        />
      </Group>
    </Page>
  )
}
