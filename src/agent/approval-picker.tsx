import { useStored } from "@/core/lib/hooks/use-stored"
import { ChevronDown } from "lucide-react"
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

export function useApprovalLevel(): ApprovalLevel {
  return parseApprovalLevel(useStored(APPROVAL_KEY))
}

// Selector del Nivel de aprobación en el composer; persiste por dispositivo.
export function ApprovalPicker() {
  const level = useApprovalLevel()
  const current = APPROVAL_LEVELS.find((l) => l.id === level)!
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Nivel de aprobación"
          className="max-w-full justify-start"
        >
          <span className="mono-dim truncate">{current.name}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={level}
          onValueChange={(v) => saveApprovalLevel(v as ApprovalLevel)}
        >
          {APPROVAL_LEVELS.map((l) => (
            <DropdownMenuRadioItem key={l.id} value={l.id}>
              {l.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
