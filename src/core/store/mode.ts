import { hasSupabaseEnv } from "@/core/lib/supabase"
import type { StorageMode } from "@/core/store/types"

export const MODE_KEY = "bita-storage"

// Supabase es el default (CONTEXT.md: "Stack cerrado"). El modo local es opt-in explícito, con
// una excepción: si no hay env de Supabase, el default es local — así clonar el repo y correr
// `pnpm dev` sin proyecto muestra la app en vez de una pantalla en blanco.
export function storageMode(): StorageMode {
  if (!hasSupabaseEnv) return "local"
  return localStorage.getItem(MODE_KEY) === "local" ? "local" : "supabase"
}

// Cambiar de modo recarga a propósito: las caches de React Query están llenas de filas del otro
// backend, y los ids no significan lo mismo de un lado y del otro. Recargar es una línea; drenar
// la cache a mano son veinte y un bug esperando.
export function setStorageMode(mode: StorageMode) {
  localStorage.setItem(MODE_KEY, mode)
  location.reload()
}
