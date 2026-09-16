import type { TiptapDoc } from "@/core/types/database"

export type LightboxImage = { src: string; alt?: string }

export function collectImages(doc: TiptapDoc): LightboxImage[] {
  const out: LightboxImage[] = []
  const walk = (nodes: unknown[]) => {
    for (const n of nodes) {
      if (!n || typeof n !== "object") continue
      const node = n as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }
      if (node.type === "image" && typeof node.attrs?.src === "string") {
        out.push({
          src: node.attrs.src,
          alt: typeof node.attrs.alt === "string" ? node.attrs.alt : undefined,
        })
      }
      if (Array.isArray(node.content)) walk(node.content)
    }
  }
  walk((doc.content as unknown[]) ?? [])
  return out
}
