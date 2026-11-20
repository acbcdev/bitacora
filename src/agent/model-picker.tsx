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
import { saveAgentSettings, type AgentSettings, type ProviderConfig } from "@/core/agent/provider"
import { ProviderIcon } from "@/agent/provider-icon"

// Selector de modelo del composer: los modelos visibles de todos los Proveedores. El valor es
// "<providerId>\n<modelId>" porque el id del modelo puede traer cualquier carácter.
export function ModelPicker({
  settings,
  active,
}: {
  settings: AgentSettings
  active: { provider: ProviderConfig; modelId: string }
}) {
  const groups = settings.providers.filter((p) => p.models.some((m) => m.visible))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Modelo" className="max-w-full justify-start">
          <ProviderIcon provider={active.provider} />
          <span className="mono-dim truncate">{active.modelId}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 max-w-[min(20rem,90vw)]">
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
                  </DropdownMenuRadioItem>
                ))}
            </div>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
