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

export async function fetchBlob(src: string): Promise<Blob> {
  const res = await fetch(src)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.blob()
}

export async function downloadImage(src: string, alt?: string) {
  const blob = await fetchBlob(src)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${alt || "imagen"}.${blob.type.split(/[/+]/)[1] || "png"}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000) // revocar ya mismo corta la descarga en algunos browsers
}

// ClipboardItem solo acepta image/png: JPG/WebP pasan por canvas.
async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob
  const bmp = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bmp.width
  canvas.height = bmp.height
  canvas.getContext("2d")!.drawImage(bmp, 0, 0)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png"),
  )
}

// async sin await previo: clipboard.write corre síncrono dentro del gesto (Safari) y recibe la
// promesa del blob, no el blob resuelto.
export async function copyImage(src: string) {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": fetchBlob(src).then(toPng) })])
}
