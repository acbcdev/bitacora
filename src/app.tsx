import { useEffect, useRef, useState } from "react"
import { Route, Routes, useLocation, useNavigate } from "react-router-dom"
import type { Session } from "@supabase/supabase-js"
import {
  BookOpen,
  ChevronRight,
  Command,
  Flame,
  LogOut,
  Maximize2,
  Moon,
  PanelLeft,
  Plus,
  Sun,
} from "lucide-react"
import { CommandPalette, type Action } from "@/components/command-palette"
import { Cheatsheet } from "@/components/cheatsheet"
import { Sidebar } from "@/components/sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useCourses } from "@/lib/courses"
import { useAllNoteRefs } from "@/lib/notes"
import { useReadStats } from "@/lib/stats"
import { supabase } from "@/lib/supabase"
import { Course } from "@/pages/course"
import { Courses } from "@/pages/courses"
import { Login } from "@/pages/login"
import { Note } from "@/pages/note"
import { Review } from "@/pages/review"

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
  return <Shell />
}

// Shell del diseño: sidebar + main scrolleable + overlays (⌘K, ?). En focus mode (tecla F)
// desaparece todo el chrome y queda sola la nota.
function Shell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: courses = [] } = useCourses()
  const { data: notes = [] } = useAllNoteRefs()
  const { data: stats } = useReadStats()

  const [palette, setPalette] = useState(false)
  const [cheat, setCheat] = useState(false)
  const [focus, setFocus] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("bita-sb") === "1")
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("bita-theme", dark ? "dark" : "light")
  }, [dark])

  // Cambiar de pantalla sale de focus mode.
  useEffect(() => setFocus(false), [pathname])

  function toggleSidebar() {
    setCollapsed((c) => {
      localStorage.setItem("bita-sb", c ? "0" : "1")
      return !c
    })
  }

  // Teclado global: ⌘K, ? y la secuencia G+H / G+C. Space/J/K son de cada pantalla.
  const seq = useRef({ key: "", at: 0 })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPalette((p) => !p)
        return
      }
      const el = e.target as HTMLElement | null
      if (el?.closest?.("input, textarea, select, [contenteditable=true]")) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === "?") {
        e.preventDefault()
        setCheat(true)
        return
      }
      const key = e.key.toLowerCase()
      if (seq.current.key === "g" && Date.now() - seq.current.at < 900) {
        seq.current.key = ""
        if (key === "h") {
          e.preventDefault()
          navigate("/")
          return
        }
        if (key === "c") {
          e.preventDefault()
          navigate("/courses")
          return
        }
      }
      if (key === "g") seq.current = { key: "g", at: Date.now() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate])

  // Se arma sólo cuando la palette abre — mapear ~1.500 notas en cada render no tiene sentido.
  function actions(): Action[] {
    const courseName = new Map(courses.map((c) => [c.id, c.name]))
    return [
      {
        group: "Navegar",
        label: "Ir a Hoy",
        kbd: "G H",
        icon: <Flame />,
        run: () => navigate("/"),
      },
      {
        group: "Navegar",
        label: "Ir a Cursos",
        kbd: "G C",
        icon: <BookOpen />,
        run: () => navigate("/courses"),
      },
      {
        group: "Acciones",
        label: "Nuevo curso",
        icon: <Plus />,
        run: () => navigate("/courses?new=1"),
      },
      {
        group: "Vista",
        label: collapsed ? "Expandir sidebar" : "Colapsar sidebar",
        icon: <PanelLeft />,
        run: toggleSidebar,
      },
      {
        group: "Vista",
        label: dark ? "Tema claro" : "Tema oscuro",
        icon: dark ? <Sun /> : <Moon />,
        run: () => setDark((d) => !d),
      },
      {
        group: "Vista",
        label: "Focus mode",
        kbd: "F",
        icon: <Maximize2 />,
        run: () => setFocus(true),
      },
      {
        group: "Vista",
        label: "Atajos de teclado",
        kbd: "?",
        icon: <Command />,
        run: () => setCheat(true),
      },
      {
        group: "Cuenta",
        label: "Cerrar sesión",
        icon: <LogOut />,
        run: () => supabase.auth.signOut(),
      },
      ...courses.map((c) => ({
        group: "Cursos",
        label: c.name,
        icon: <BookOpen />,
        run: () => navigate(`/course/${c.id}`),
      })),
      ...notes.map((n) => ({
        group: "Notas",
        label: `${n.title || "(sin título)"}${n.course_id ? ` — ${courseName.get(n.course_id) ?? ""}` : ""}`,
        icon: <ChevronRight />,
        run: () => navigate(`/note/${n.id}`),
      })),
    ]
  }

  return (
    // Un solo TooltipProvider para toda la app: los tooltips del sidebar y los de los botones de
    // icono de las pantallas cuelgan de acá.
    <TooltipProvider>
      <SidebarProvider
        open={!collapsed}
        onOpenChange={(open) => {
          localStorage.setItem("bita-sb", open ? "0" : "1")
          setCollapsed(!open)
        }}
        className="h-screen min-h-0 overflow-hidden"
        style={
          { "--sidebar-width": "216px", "--sidebar-width-icon": "56px" } as React.CSSProperties
        }
      >
        {!focus && (
          <Sidebar
            courses={courses}
            streak={stats?.streak ?? 0}
            dark={dark}
            onToggleTheme={() => setDark((d) => !d)}
            onLogout={() => supabase.auth.signOut()}
          />
        )}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Review />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/course/:id" element={<Course />} />
            <Route path="/note/:id" element={<Note focus={focus} setFocus={setFocus} />} />
          </Routes>
        </main>

        {palette && <CommandPalette onClose={() => setPalette(false)} actions={actions()} />}
        {cheat && <Cheatsheet onClose={() => setCheat(false)} />}
        <Toaster theme={dark ? "dark" : "light"} />
      </SidebarProvider>
    </TooltipProvider>
  )
}
