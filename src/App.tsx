import { useEffect, useState } from "react"
import { NavLink, Route, Routes } from "react-router-dom"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { Login } from "@/pages/Login"
import { Review } from "@/pages/Review"
import { Courses } from "@/pages/Courses"
import { Note } from "@/pages/Note"

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

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Review />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/note/:id" element={<Note />} />
      </Routes>
    </>
  )
}

// Chrome mínimo (ui-principles): dos links + salir. Nada más.
function Nav() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "font-medium" : "text-muted-foreground hover:underline"
  return (
    <nav className="mx-auto flex max-w-2xl items-center gap-4 border-b px-6 py-3 text-sm">
      <NavLink to="/" end className={cls}>
        Repaso
      </NavLink>
      <NavLink to="/courses" className={cls}>
        Cursos
      </NavLink>
      <button className="ml-auto text-muted-foreground hover:underline" onClick={() => supabase.auth.signOut()}>
        Salir
      </button>
    </nav>
  )
}
