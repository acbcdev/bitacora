import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { Login } from "@/pages/Login"

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return null
  if (!session) return <Login />

  // ponytail: placeholder. Las 3 pantallas (repaso/cursos/nota) son otros features.
  return (
    <main className="mx-auto max-w-md p-8">
      <p className="text-sm text-neutral-600">Sesión activa: {session.user.email}</p>
      <button className="mt-4 underline" onClick={() => supabase.auth.signOut()}>
        Salir
      </button>
    </main>
  )
}
