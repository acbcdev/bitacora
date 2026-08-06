import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const OUT_DIR = "scripts/notion-import/.out"
const CACHE_DIR = join(OUT_DIR, "cache")

// Checkpoint por curso: el archivo se llama como el page id de Notion del curso y guarda sus filas
// ya armadas (curso + todas sus notas, con las URLs de Storage ya resueltas). Si la corrida se
// corta (rate limit, ctrl-c), el siguiente intento lee del disco y no vuelve a pegarle a la API ni
// resube imágenes. Granularidad por curso y no por nota a propósito: son ~50 archivos en vez de
// ~1500. El costo es que un corte a mitad de un curso reprocesa ese curso entero.
// Para forzar un refetch: borrar .out/cache (o el json del curso puntual).
export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const file = join(CACHE_DIR, `${key}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as T

  const value = await fn()
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(file, JSON.stringify(value))
  return value
}
