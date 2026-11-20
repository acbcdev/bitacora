import { ChevronDown } from "lucide-react"
import { Button } from "@/core/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import type { Caps } from "@/core/agent/capabilities"
import { saveAgentSettings, type AgentSettings, type ProviderConfig } from "@/core/agent/provider"
import { ProviderIcon } from "@/agent/provider-icon"

// Best-effort: solo un `false` explícito muestra badge, y nunca bloquea elegir el modelo.
export function CapBadges({ caps }: { caps?: Caps }) {
  return (
    <>
      {caps?.tools === false && <span className="mono-dim shrink-0">sin tools</span>}
      {caps?.vision === false && <span className="mono-dim shrink-0">sin visión</span>}
    </>
  )
}

// Selector de modelo del composer: los modelos visibles de todos los Proveedores. El valor es
// "<providerId>\n<modelId>" porque el id del modelo puede traer cualquier carácter.
export function ModelPicker({
  settings,
  active,
}: {
  settings: AgentSettings
  active: { provider: ProviderConfig; modelId: string }
}) {
  const caps = active.provider.models.find((m) => m.id === active.modelId)?.caps
  const groups = settings.providers.filter((p) => p.models.some((m) => m.visible))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Modelo" className="max-w-full justify-start">
          <ProviderIcon provider={active.provider} />
          <span className="mono-dim truncate">{active.modelId}</span>
          <CapBadges caps={caps} />
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 max-w-xs">
        <DropdownMenuRadioGroup
          value={`${active.provider.id}\n${active.modelId}`}
          onValueChange={(v) => {
            const [providerId, modelId] = v.split("\n")
            saveAgentSettings({ ...settings, active: { providerId, modelId } })
          }}
        >
          {groups.map((p) => (
            <div key={p.id}>
              <DropdownMenuLabel className="flex items-center gap-2">
                <ProviderIcon provider={p} />
                {p.name}
              </DropdownMenuLabel>
              {p.models
                .filter((m) => m.visible)
                .map((m) => (
                  <DropdownMenuRadioItem key={m.id} value={`${p.id}\n${m.id}`}>
                    <span className="truncate">{m.id}</span>
                    <CapBadges caps={m.caps} />
                  </DropdownMenuRadioItem>
                ))}
            </div>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
