import type { ComponentType } from "react"
import { useStored } from "@/core/lib/hooks/use-stored"
import { ChevronDown, Eye, Hand, Zap } from "lucide-react"
import { Button } from "@/core/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import {
  APPROVAL_KEY,
  APPROVAL_LEVELS,
  parseApprovalLevel,
  saveApprovalLevel,
  type ApprovalLevel,
} from "@/core/agent/approval"
import { cn } from "@/core/lib/utils"

export function useApprovalLevel(): ApprovalLevel {
  return parseApprovalLevel(useStored(APPROVAL_KEY))
}

// Qué hace cada nivel — espeja `autoApplies` en core/agent/approval.ts.
const INFO: Record<ApprovalLevel, { icon: ComponentType<{ className?: string }>; desc: string }> = {
  ask: { icon: Hand, desc: "Cada cambio pasa por una Propuesta que aprobás vos." },
  review: { icon: Eye, desc: "Aplica solo lo aditivo. Lo que borra o reemplaza te lo pregunta." },
  skip: { icon: Zap, desc: "Aplica todo sin preguntar. Solo si confiás en el modelo." },
}

// Selector del Nivel de aprobación en el composer; persiste por dispositivo. `skip` se tiñe de
// warning: es el único nivel que puede borrar sin preguntar.
export function ApprovalPicker() {
  const level = useApprovalLevel()
  const current = APPROVAL_LEVELS.find((l) => l.id === level)!
  const risky = level === "skip"
  const Icon = INFO[level].icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Nivel de aprobación"
          className={cn("max-w-full justify-start", risky && "text-warning hover:text-warning")}
        >
          <Icon />
          <span className={cn("mono-dim truncate", risky && "text-warning")}>{current.name}</span>
          <ChevronDown className="transition-[rotate] duration-150 ease-out group-aria-expanded/button:rotate-180 motion-reduce:transition-none" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-72 max-w-(--radix-dropdown-menu-content-available-width) rounded-xl p-1.5"
      >
        <DropdownMenuRadioGroup
          value={level}
          onValueChange={(v) => saveApprovalLevel(v as ApprovalLevel)}
        >
          {APPROVAL_LEVELS.map((l) => {
            const { icon: LevelIcon, desc } = INFO[l.id]
            return (
              <DropdownMenuRadioItem
                key={l.id}
                value={l.id}
                className="group/dropdown-menu-item items-center gap-3 rounded-lg px-2 py-2 pr-9"
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground group-focus/dropdown-menu-item:bg-background",
                    l.id === "skip" && "text-warning",
                  )}
                >
                  <LevelIcon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span>{l.name}</span>
                  <span className="text-xs leading-snug text-muted-foreground">{desc}</span>
                </span>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
