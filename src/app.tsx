import { useEffect, useState } from "react"
import { Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
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
import { CommandPalette, type Action } from "@/core/components/command-palette"
import { Cheatsheet } from "@/core/components/cheatsheet"
import { Sidebar } from "@/core/components/sidebar"
import { SidebarProvider, SidebarTrigger } from "@/core/ui/sidebar"
import { Toaster } from "@/core/ui/sonner"
import { TooltipProvider } from "@/core/ui/tooltip"
import { useCourses } from "@/courses/courses.api"
import { useAllNoteRefs } from "@/notes/notes.api"
import { useReadStats } from "@/core/lib/stats"
import { supabase } from "@/core/lib/supabase"
import { Course } from "@/courses/course"
import { Courses } from "@/courses/courses"
import { Login } from "@/login/login"
import { Note } from "@/notes/note"
import { Review } from "@/review/review"

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
  // ⌘K funciona incluso dentro de inputs/contenteditable, el resto no (default de la lib).
  useHotkeys("mod+k", () => setPalette((p) => !p), {
    enableOnFormTags: true,
    enableOnContentEditable: true,
    preventDefault: true,
  })
  // "?" físico es shift+/ — e.key ya no sirve de referencia con la lib, se ata a la tecla.
  useHotkeys("shift+slash", () => setCheat(true), { preventDefault: true })
  useHotkeys("g>h", () => navigate("/"), { sequenceTimeoutMs: 900, preventDefault: true })
  useHotkeys("g>c", () => navigate("/courses"), { sequenceTimeoutMs: 900, preventDefault: true })

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
        run: () => navigate(n.course_id ? `/course/${n.course_id}/${n.id}` : `/note/${n.id}`),
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
          {/* En mobile el Sidebar es un Sheet cerrado: su propio trigger vive adentro y no se ve
              hasta abrirlo. Este de acá afuera es el único modo de abrirlo. En flujo normal, no
              fixed: así no se pisa con el h1 de cada pantalla. */}
          <SidebarTrigger className="mt-2 ml-2 md:hidden" />
          <Routes>
            <Route path="/" element={<Review />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/course/:id" element={<Course focus={focus} setFocus={setFocus} />} />
            <Route
              path="/course/:id/:noteId"
              element={<Course focus={focus} setFocus={setFocus} />}
            />
            {/* Solo para notas sin curso (note.course_id null) — con curso, la ruta principal
                es /course/:id/:noteId de arriba. */}
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
