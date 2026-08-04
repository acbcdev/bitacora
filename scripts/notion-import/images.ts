import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

function extFromContentType(contentType: string | null): string {
  if (contentType?.includes("png")) return "png"
  if (contentType?.includes("webp")) return "webp"
  if (contentType?.includes("gif")) return "gif"
  return "jpg"
}

// Descarga desde Notion y sube a un bucket de Supabase Storage, en la misma corrida (spec: las
// URLs `file` de Notion expiran ~1h, no se guardan para después). Sirve tanto para imágenes de
// notas (bucket 'notes-images') como para íconos de página tipo `file` (bucket 'course-icons').
export async function uploadImage(
  supabase: SupabaseClient,
  bucket: string,
  userId: string,
  sourceUrl: string,
): Promise<string> {
  const res = await fetch(sourceUrl)
  if (!res.ok) throw new Error(`descarga de ${sourceUrl} falló: ${res.status}`)
  const contentType = res.headers.get("content-type")
  const bytes = await res.arrayBuffer()
  const path = `${userId}/${randomUUID()}.${extFromContentType(contentType)}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: contentType ?? "image/jpeg" })
  if (error) throw new Error(`upload a ${bucket}/${path} falló: ${error.message}`)

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
