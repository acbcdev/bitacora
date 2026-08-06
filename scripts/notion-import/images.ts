import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

// Los iconos `external` apuntan al CDN del curso original (static.platzi.com y cía), que devuelve
// 403 + HTML al User-Agent por defecto de undici. Con UA de browser: 200.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

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
  const res = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } })
  if (!res.ok) {
    // Sin la query string: son 2000 caracteres de firma de S3 que tapan el error. El body de S3 sí
    // dice el motivo real (`AccessDenied` vs `Request has expired` — la firma dura 1h).
    const { origin, pathname } = new URL(sourceUrl)
    const body = (await res.text()).replace(/\s+/g, " ").slice(0, 300)
    throw new Error(`descarga de ${origin}${pathname} falló: ${res.status} — ${body}`)
  }
  const contentType = res.headers.get("content-type")
  const bytes = await res.arrayBuffer()
  const path = `${userId}/${randomUUID()}.${extFromContentType(contentType)}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: contentType ?? "image/jpeg" })
  if (error) throw new Error(`upload a ${bucket}/${path} falló: ${error.message}`)

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
