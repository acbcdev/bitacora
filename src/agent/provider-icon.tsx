import { Cpu } from "lucide-react"
import type { ProviderConfig } from "@/core/agent/provider"

// Íconos inline simplificados (monocromo, currentColor). LM Studio y Compatible: genérico.
const PATHS: Record<string, string> = {
  anthropic: "M13.8 3h-3.6L4 21h3.5l1.2-3.6h6.6l1.2 3.6H20zM9.7 14.6 12 7.8l2.3 6.8z",
  openrouter: "M3 13h5c3 0 3-6 7-6h3M15 4l3 3-3 3M3 11h5c3 0 3 6 7 6h3M15 14l3 3-3 3",
  openai:
    "M12 3a4.5 4.5 0 0 1 4.3 3.1A4.5 4.5 0 0 1 19 13a4.5 4.5 0 0 1-7 6 4.5 4.5 0 0 1-6.9-6A4.5 4.5 0 0 1 12 3z",
  gemini:
    "M12 2c.6 5.5 4.5 9.4 10 10-5.5.6-9.4 4.5-10 10-.6-5.5-4.5-9.4-10-10 5.5-.6 9.4-4.5 10-10z",
  ollama:
    "M7 3c1.5 0 2.5 2 2.5 4.5M17 3c-1.5 0-2.5 2-2.5 4.5M12 7a6 6 0 0 0-6 6v3a5 5 0 0 0 5 5h2a5 5 0 0 0 5-5v-3a6 6 0 0 0-6-6z",
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
  const d = PATHS[providerIconKey(provider)]
  if (!d) return <Cpu className={className} aria-hidden />
  const stroke = d.includes("M3 13") || d.includes("M7 3")
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill={stroke ? "none" : "currentColor"}
      stroke={stroke ? "currentColor" : "none"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}
