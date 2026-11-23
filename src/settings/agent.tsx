import { Eye, Hand, Zap } from "lucide-react"
import { Button } from "@/core/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/core/ui/select"
import { cn } from "@/core/lib/utils"
import { useStored } from "@/core/lib/hooks/use-stored"
import {
  APPROVAL_KEY,
  APPROVAL_LEVELS,
  parseApprovalLevel,
  saveApprovalLevel,
  type ApprovalLevel,
} from "@/core/agent/approval"
import { saveAgentSettings, visibleModels } from "@/core/agent/provider"
import { useAgentSettings } from "@/agent/use-provider"
import { ProviderSettings } from "@/agent/provider-settings"
import { SkillsSettings } from "@/agent/skills-settings"
import { Block, Group, Page, Row } from "@/settings/ui"

export function ProvidersPage() {
  const { settings } = useAgentSettings()
  const models = visibleModels(settings).length
  return (
    <Page
      title="Proveedores"
      desc={`${settings.providers.length} configurados · ${models} modelos visibles. Las keys viven solo en este navegador y salen directo hacia cada Proveedor.`}
    >
      <ProviderSettings />
    </Page>
  )
}

const LEVEL_INFO: Record<ApprovalLevel, { icon: typeof Hand; desc: string }> = {
  ask: {
    icon: Hand,
    desc: "Cada cambio pasa por una Propuesta que aprobás vos.",
  },
  review: {
    icon: Eye,
    desc: "Aplica solo lo aditivo. Lo que borra o reemplaza te lo pregunta.",
  },
  skip: {
    icon: Zap,
    desc: "Aplica todo sin preguntar. Solo si confiás en el modelo.",
  },
}

export function ModelPage({ go }: { go: (id: string) => void }) {
  const { settings, active } = useAgentSettings()
  const all = visibleModels(settings)
  const level = parseApprovalLevel(useStored(APPROVAL_KEY))
  const value = active ? `${active.provider.id}::${active.modelId}` : ""
  return (
    <Page
      title="Modelo y aprobaciones"
      desc="Con qué modelo habla el Agente y cuánto te pregunta antes de tocar tus notas."
    >
      <Group title="Modelo por defecto">
        {all.length === 0 ? (
          <Row label="Sin modelos" desc="Agregá un Proveedor para elegir modelo.">
            <Button size="sm" variant="outline" onClick={() => go("proveedores")}>
              Ir a Proveedores
            </Button>
          </Row>
        ) : (
          <Row label="Modelo activo" desc="El del chat nuevo. Se cambia también desde el composer.">
            <Select
              value={value}
              onValueChange={(v) => {
                const [providerId, modelId] = v.split("::")
                saveAgentSettings({ ...settings, active: { providerId, modelId } })
              }}
            >
              <SelectTrigger aria-label="Modelo activo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {settings.providers.map((p) => (
                  <SelectGroup key={p.id}>
                    <SelectLabel>{p.name}</SelectLabel>
                    {p.models
                      .filter((m) => m.visible)
                      .map((m) => (
                        <SelectItem key={m.id} value={`${p.id}::${m.id}`}>
                          {m.id}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Row>
        )}
      </Group>
      <Group
        title="Nivel de aprobación"
        desc="Los niveles menos estrictos aceptan riesgo de prompt injection: una nota maliciosa podría hacer que el Agente cambie cosas sin preguntarte."
      >
        {APPROVAL_LEVELS.map((l) => {
          const { icon: Icon, desc } = LEVEL_INFO[l.id]
          const on = level === l.id
          return (
            <Block key={l.id} className="py-0">
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => saveApprovalLevel(l.id)}
                className="flex w-full items-start gap-3 py-3.5 text-left"
              >
                <Icon className={cn("mt-0.5 shrink-0", l.id === "skip" && "text-warning")} />
                <span className="flex flex-1 flex-col">
                  <span className={cn("text-sm font-medium", l.id === "skip" && "text-warning")}>
                    {l.name}
                  </span>
                  <span className="text-sm text-muted-foreground">{desc}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                    on ? "border-foreground" : "border-border-strong/40",
                  )}
                >
                  {on && <span className="size-2 rounded-full bg-foreground" />}
                </span>
              </button>
            </Block>
          )
        })}
      </Group>
    </Page>
  )
}

export function SkillsPage() {
  return (
    <Page
      title="Skills"
      desc="Instrucciones que invocás con /nombre en el chat. Editar una de fábrica guarda un override."
    >
      <SkillsSettings />
    </Page>
  )
}
