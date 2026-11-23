import { useState } from "react"
import { Command } from "cmdk"
import { Check, ChevronDown, EyeOff, Search, WrenchOff } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/core/ui/popover"
import type { Caps } from "@/core/agent/capabilities"
import { saveAgentSettings, type AgentSettings, type ProviderConfig } from "@/core/agent/provider"
import { ProviderIcon } from "@/agent/provider-icon"

// Best-effort: solo un `false` explícito muestra ícono tachado, y nunca bloquea elegir el modelo.
// Solo en el menú: el trigger queda limpio.
function CapIcons({ caps }: { caps?: Caps }) {
  return (
    <>
      {caps?.tools === false && (
        <WrenchOff aria-label="Sin tools" strokeWidth={1.75} className="size-3" />
      )}
      {caps?.vision === false && (
        <EyeOff aria-label="Sin visión" strokeWidth={1.75} className="size-3" />
      )}
    </>
  )
}

// Cuerpo aparte del Popover: se monta al abrir, así la fila resaltada arranca en el modelo activo.
function Models({
  settings,
  selected,
  onPick,
}: {
  settings: AgentSettings
  selected: string
  onPick: () => void
}) {
  const [highlighted, setHighlighted] = useState(selected)
  return (
    <Command value={highlighted} onValueChange={setHighlighted} className="flex flex-col">
      <div className="flex items-center gap-2.5 border-b border-foreground/6 px-3.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Command.Input
          autoFocus
          placeholder="Buscar modelo…"
          className="h-11 w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
        />
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
          Ningún modelo coincide
        </Command.Empty>
        {settings.providers.flatMap((p) =>
          p.models
            .filter((m) => m.visible)
            .map((m) => {
              const value = `${p.id}\n${m.id}`
              return (
                <Command.Item
                  key={value}
                  value={value}
                  keywords={[p.name]}
                  onSelect={() => {
                    saveAgentSettings({ ...settings, active: { providerId: p.id, modelId: m.id } })
                    onPick()
                  }}
                  className="flex cursor-default flex-col gap-0.5 rounded-lg px-3 py-2 transition-colors duration-100 data-selected:bg-accent"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span className="truncate">{m.id}</span>
                    {value === selected && (
                      <Check className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ProviderIcon provider={p} className="size-3" />
                    {p.name}
                    <CapIcons caps={m.caps} />
                  </span>
                </Command.Item>
              )
            }),
        )}
      </Command.List>
    </Command>
  )
}

// Selector de modelo del composer: los modelos visibles de todos los Proveedores, con búsqueda. El
// valor de cada fila es "<providerId>\n<modelId>" porque el id del modelo puede traer cualquier carácter.
export function ModelPicker({
  settings,
  active,
}: {
  settings: AgentSettings
  active: { provider: ProviderConfig; modelId: string }
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Modelo" className="max-w-full justify-start">
          <ProviderIcon provider={active.provider} />
          <span className="mono-dim truncate">{active.modelId}</span>
          <ChevronDown className="transition-[rotate] duration-150 ease-out group-aria-expanded/button:rotate-180 motion-reduce:transition-none" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-w-(--radix-popover-content-available-width) gap-0 rounded-xl p-0"
      >
        <Models
          settings={settings}
          selected={`${active.provider.id}\n${active.modelId}`}
          onPick={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
