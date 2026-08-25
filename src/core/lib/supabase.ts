import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/core/types/database"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const hasSupabaseEnv = !!(url && key)

let client: SupabaseClient<Database> | undefined

// Lazy y no `export const supabase = createClient(...)`: `createClient` TIRA si falta la url o la
// key, y lo hacía en tiempo de import. Eso significaba que clonar el repo sin proyecto Supabase
// no arrancaba ni siquiera para mirar la app en modo local. Ahora el cliente se construye la
// primera vez que alguien lo pide — y en modo local nadie lo pide.
export function getSupabase() {
  if (!hasSupabaseEnv) {
    throw new Error("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY en .env")
  }
  client ??= createClient<Database>(url, key)
  return client
}
