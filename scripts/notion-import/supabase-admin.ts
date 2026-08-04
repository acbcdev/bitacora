import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Cliente de escritura del script CLI: usa la service_role key porque no hay sesión de browser
// que provea auth.uid() para las policies de RLS. La key nunca va al cliente ni al repo
// (CONTEXT.md § Seguridad) — se lee de .env, que está gitignored.
export function createAdminClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Sin sesión, user_id va explícito en cada insert. La app es de un solo usuario (CONTEXT.md),
// así que se resuelve solo; si hay más de uno, cortar antes que escribir a nombre del equivocado.
export async function resolveSingleUserId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) throw new Error(`no se pudo listar usuarios: ${error.message}`)
  if (data.users.length !== 1) {
    throw new Error(`se esperaba exactamente 1 usuario, hay ${data.users.length}`)
  }
  return data.users[0].id
}
