import { collectPaginatedAPI, isFullBlock, type Client } from "@notionhq/client"
import type { ResolvedBlock } from "./blocks-to-tiptap"

// Arma el árbol de bloques de una página (paginado + recursivo por has_children) y resuelve cada
// imagen a su URL final (uploadImage) en el mismo paso — es I/O de punta a punta, por eso vive
// separado del conversor puro blocks-to-tiptap.ts.
export async function fetchBlockTree(
  notion: Client,
  blockId: string,
  uploadImage: (sourceUrl: string) => Promise<string>,
): Promise<ResolvedBlock[]> {
  const blocks = (
    await collectPaginatedAPI(notion.blocks.children.list, { block_id: blockId })
  ).filter(isFullBlock)

  const resolved: ResolvedBlock[] = []
  for (const block of blocks) {
    const children = block.has_children ? await fetchBlockTree(notion, block.id, uploadImage) : []

    if (block.type === "image") {
      const sourceUrl =
        block.image.type === "external" ? block.image.external.url : block.image.file.url
      const url = await uploadImage(sourceUrl)
      resolved.push({
        ...block,
        image: { type: "external", external: { url }, caption: block.image.caption },
        children,
      } as ResolvedBlock)
      continue
    }

    resolved.push({ ...block, children } as ResolvedBlock)
  }
  return resolved
}
