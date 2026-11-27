import { Cpu } from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import type { ProviderConfig } from "@/core/agent/provider"
import { AnthropicBlack } from "@/core/ui/svgs/anthropicBlack"
import { AnthropicWhite } from "@/core/ui/svgs/anthropicWhite"
import { Gemini } from "@/core/ui/svgs/gemini"
import { Lmstudio } from "@/core/ui/svgs/lmstudio"
import { OllamaDark } from "@/core/ui/svgs/ollamaDark"
import { OllamaLight } from "@/core/ui/svgs/ollamaLight"
import { Openai } from "@/core/ui/svgs/openai"
import { OpenaiDark } from "@/core/ui/svgs/openaiDark"
import { OpenrouterDark } from "@/core/ui/svgs/openrouterDark"
import { OpenrouterLight } from "@/core/ui/svgs/openrouterLight"

type Svg = ComponentType<SVGProps<SVGSVGElement>>

// Íconos de svgl (`pnpm dlx shadcn add @svgl/<name>`). [light, dark]; Gemini y LM Studio son a
// color (un solo ícono). LM Studio no existe en svgl: es el logo oficial a mano. El resto cae a Cpu.
const ICONS: Record<string, [Svg, Svg?]> = {
  anthropic: [AnthropicBlack, AnthropicWhite],
  openrouter: [OpenrouterLight, OpenrouterDark],
  openai: [Openai, OpenaiDark],
  gemini: [Gemini],
  ollama: [OllamaLight, OllamaDark],
  lmstudio: [Lmstudio],
}

export function providerIconKey(p: Pick<ProviderConfig, "kind" | "preset">) {
  return p.kind === "openai-compatible" ? (p.preset ?? "") : p.kind
}

export function ProviderIcon({
  provider,
  className = "size-4",
}: {
  provider: Pick<ProviderConfig, "kind" | "preset">
  className?: string
}) {
  const icon = ICONS[providerIconKey(provider)]
  if (!icon) return <Cpu className={className} aria-hidden />
  const [Light, Dark] = icon
  if (!Dark) return <Light className={className} aria-hidden />
  return (
    <>
      <Light className={`${className} dark:hidden`} aria-hidden />
      <Dark className={`${className} hidden dark:block`} aria-hidden />
    </>
  )
}
