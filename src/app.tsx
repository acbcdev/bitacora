import { useEffect, useState } from "react"
import { Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import {
  BookOpen,
  Command,
  Flame,
  LogOut,
  Maximize2,
  Moon,
  PanelLeft,
  Plus,
  Settings as SettingsIcon,
  StickyNote,
  Sun,
} from "lucide-react"
import { CommandPalette, type Action } from "@/core/components/command-palette"
import { Cheatsheet } from "@/core/components/cheatsheet"
import { courseJumps, Sidebar, sidebarCourseGroups } from "@/core/components/sidebar"
import { SidebarProvider, SidebarTrigger } from "@/core/ui/sidebar"
import { Toaster } from "@/core/ui/sonner"
import { TooltipProvider } from "@/core/ui/tooltip"
import { CourseIcon } from "@/courses/course-icon"
import { useCourses } from "@/courses/courses.api"
import { usePinnedCourseIds } from "@/courses/pinned-courses"
import { useAllNoteRefs } from "@/notes/notes.api"
import { Settings } from "@/settings/settings"
import { store } from "@/core/store"
import type { AuthUser } from "@/core/store/types"
import { mod } from "@/core/lib/utils"
import { Course } from "@/courses/course"
import { Courses } from "@/courses/courses"
import { ErrorBoundary } from "@/core/components/error-boundary"
import { Login } from "@/login/login"
import { Note } from "@/notes/note"
import { Review } from "@/review/review"

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // El seam de auth es del Store, no de Supabase: en modo local `getUser()` resuelve enseguida con
  // el usuario del navegador y nunca se ve el Login.
  useEffect(() => {
    store.auth.getUser().then((u) => {
      setUser(u)
      setLoading(false)
    })
    return store.auth.onChange(setUser)
  }, [])

  if (loading) return null
  if (!user) return <Login />
  return <Shell user={user} />
}

// Shell del diseño: sidebar + main scrolleable + overlays (⌘K, ?). En focus mode (tecla F)
// desaparece todo el chrome y queda sola la nota.
function Shell({ user }: { user: AuthUser }) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { data: courses = [] } = useCourses()
  const { data: notes = [] } = useAllNoteRefs()
  const pinnedIds = usePinnedCourseIds()

  const [palette, setPalette] = useState(false)
  const [cheat, setCheat] = useState(false)
  const [settings, setSettings] = useState(false)
  const [focus, setFocus] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("bita-sb") === "1")
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("bita-theme", dark ? "dark" : "light")
  }, [dark])

  // Cambiar de pantalla sale de focus mode — salvo que la URL lo pida con `?focus=1`, que es
  // como el menú de acciones de la nota abre "Focus" desde el dialog de Repaso.
  useEffect(() => setFocus(new URLSearchParams(search).has("focus")), [pathname, search])

  // Focus = fullscreen nativo (como un video): se va también el chrome del browser, no sólo el
  // de la app. requestFullscreen exige gesto del usuario: con `?focus=1` (navegación, sin
  // gesto) la promesa rechaza y queda sólo el layout sin chrome — de ahí el catch.
  // ponytail: Fullscreen API pelada, sin prefijos webkit (Safari 16.4+ ya va sin ellos).
  useEffect(() => {
    if (focus) document.documentElement.requestFullscreen().catch(() => {})
    else if (document.fullscreenElement) document.exitFullscreen()

    // Esc y F11 salen del fullscreen sin pasar por React (el browser se come la tecla).
    function sync() {
      if (!document.fullscreenElement) setFocus(false)
    }
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [focus])

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
  // "slash", no "/": la lib matchea por tecla física (e.code), no por e.key.
  useHotkeys("mod+slash", () => setCheat((c) => !c), {
    enableOnFormTags: true,
    enableOnContentEditable: true,
    preventDefault: true,
  })
  useHotkeys("g>h", () => navigate("/"), { sequenceTimeoutMs: 900, preventDefault: true })
  useHotkeys("g>c", () => navigate("/courses"), { sequenceTimeoutMs: 900, preventDefault: true })
  // ⌘, es la tecla de "preferencias" en macOS y la que todo el mundo prueba primero.
  useHotkeys("mod+comma", () => setSettings((s) => !s), {
    enableOnFormTags: true,
    enableOnContentEditable: true,
    preventDefault: true,
  })

  // G luego 1..9 salta a un curso del sidebar, en el mismo orden que se ve ahí.
  const { pinned, active, recent } = sidebarCourseGroups(courses, pinnedIds)
  const jumps = courseJumps([...pinned, ...active, ...recent])

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
      ...courses.map((c) => ({
        group: "Cursos",
        label: c.name,
        icon: <CourseIcon icon={c.icon} />,
        run: () => navigate(`/course/${c.id}`),
      })),
      ...notes.map((n) => ({
        group: "Notas",
        label: `${n.title || "(sin título)"}${n.course_id ? ` — ${courseName.get(n.course_id) ?? ""}` : ""}`,
        icon: <StickyNote />,
        run: () => navigate(n.course_id ? `/course/${n.course_id}/${n.id}` : `/note/${n.id}`),
      })),
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
        kbd: mod("/"),
        icon: <Command />,
        run: () => setCheat(true),
      },
      {
        group: "Vista",
        label: "Ajustes",
        kbd: mod(","),
        icon: <SettingsIcon />,
        run: () => setSettings(true),
      },
      {
        group: "Cuenta",
        label: store.mode === "local" ? "Salir del modo local" : "Cerrar sesión",
        icon: <LogOut />,
        run: () => store.auth.signOut(),
      },
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
          { "--sidebar-width": "260px", "--sidebar-width-icon": "56px" } as React.CSSProperties
        }
      >
        {!focus && (
          <Sidebar
            courses={courses}
            email={user.email}
            dark={dark}
            onToggleTheme={() => setDark((d) => !d)}
            onLogout={() => store.auth.signOut()}
            onSettings={() => setSettings(true)}
          />
        )}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {/* En mobile el Sidebar es un Sheet cerrado: su propio trigger vive adentro y no se ve
              hasta abrirlo. Este de acá afuera es el único modo de abrirlo. En flujo normal, no
              fixed: así no se pisa con el h1 de cada pantalla. */}
          <SidebarTrigger className="mt-2 ml-2 md:hidden" />
          {/* ErrorBoundary por sección: un crash en Review/Course/Note no mata el sidebar.
              key=pathname resetea al navegar — sin esto, el error quedaría pegado al cambiar de ruta. */}
          <ErrorBoundary key={pathname}>
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
          </ErrorBoundary>
        </main>

        {jumps.map(([n, c]) => (
          <CourseHotkey key={n} n={n} id={c.id} />
        ))}
        {palette && <CommandPalette onClose={() => setPalette(false)} actions={actions()} />}
        {cheat && <Cheatsheet onClose={() => setCheat(false)} />}
        {settings && (
          <Settings
            onClose={() => setSettings(false)}
            dark={dark}
            onToggleTheme={() => setDark((d) => !d)}
          />
        )}
        <Toaster theme={dark ? "dark" : "light"} />
      </SidebarProvider>
    </TooltipProvider>
  )
}

// Un componente (= un hook) por dígito, no un solo useHotkeys con los 9: la lib comparte el
// buffer de secuencia entre todos los atajos de una misma llamada, así que "g>1","g>2",... se
// pisan entre sí y sólo llega a disparar el primero.
function CourseHotkey({ n, id }: { n: number; id: string }) {
  const navigate = useNavigate()
  useHotkeys(`g>${n}`, () => navigate(`/course/${id}`), {
    sequenceTimeoutMs: 900,
    preventDefault: true,
  })
  return null
}
