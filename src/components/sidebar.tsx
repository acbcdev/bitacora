import { BookOpen, Flame, LogOut, Moon, PanelLeft, Sun } from "lucide-react"
import { NavLink } from "react-router-dom"
import type { Course } from "@/types/database"

// Sidebar del diseño: nav de 2 items + cursos activos + racha al pie. Colapsable a rail de iconos
// (chrome mínimo, ui-principles #3). El estado colapsado se persiste en localStorage.
export function Sidebar({
  courses,
  streak,
  collapsed,
  onToggle,
  dark,
  onToggleTheme,
  onLogout,
}: {
  courses: Course[]
  streak: number
  collapsed: boolean
  onToggle: () => void
  dark: boolean
  onToggleTheme: () => void
  onLogout: () => void
}) {
  const active = courses.filter((c) => c.status === "active")
  const ThemeIcon = dark ? Sun : Moon
  const themeLabel = dark ? "Tema claro" : "Tema oscuro"

  if (collapsed) {
    return (
      <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r py-3">
        <button className="icon-btn" onClick={onToggle} title="Expandir" aria-label="Expandir sidebar">
          <PanelLeft />
        </button>
        <div className="h-2" />
        <NavLink to="/" end className="icon-btn aria-[current=page]:bg-muted aria-[current=page]:text-foreground" title="Hoy">
          <Flame />
          <span className="sr-only">Hoy</span>
        </NavLink>
        <NavLink to="/courses" className="icon-btn aria-[current=page]:bg-muted aria-[current=page]:text-foreground" title="Cursos">
          <BookOpen />
          <span className="sr-only">Cursos</span>
        </NavLink>
        <button
          className="icon-btn mt-auto"
          onClick={onToggleTheme}
          title={themeLabel}
          aria-label={themeLabel}
        >
          <ThemeIcon />
        </button>
        <button className="icon-btn" onClick={onLogout} title="Salir" aria-label="Cerrar sesión">
          <LogOut />
        </button>
      </aside>
    )
  }

  return (
    <aside className="flex w-[216px] shrink-0 flex-col border-r">
      <div className="flex items-center justify-between pt-4.5 pr-2.5 pb-3.5 pl-4">
        <span className="text-base font-semibold tracking-tight">Bitácora</span>
        <button className="icon-btn" onClick={onToggle} title="Colapsar" aria-label="Colapsar sidebar">
          <PanelLeft />
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        <NavLink to="/" end className="nav-item">
          <Flame />
          Hoy
        </NavLink>
        <NavLink to="/courses" className="nav-item">
          <BookOpen />
          Cursos
        </NavLink>
      </nav>

      {active.length > 0 && (
        <>
          <p className="eyebrow px-4 pt-5 pb-2">Cursos activos</p>
          <div className="flex flex-col gap-0.5 overflow-y-auto px-2">
            {active.map((c) => (
              <NavLink key={c.id} to={`/course/${c.id}`} className="nav-item text-xs" title={c.name}>
                <span className="truncate">{c.name}</span>
              </NavLink>
            ))}
          </div>
        </>
      )}

      <div className="mt-auto border-t">
        <div className="flex items-center gap-2 px-4 pt-3">
          <Flame size={14} className="text-brand-fg" />
          <span className="mono">
            {streak} {streak === 1 ? "día" : "días"} de racha
          </span>
        </div>
        <div className="flex items-center justify-between px-4 pt-2 pb-1.5">
          <span className="mono-dim">⌘K comandos</span>
          <span className="mono-dim">? atajos</span>
        </div>
        <div className="flex flex-col gap-0.5 px-2 pb-2.5">
          <button className="nav-item" onClick={onToggleTheme}>
            <ThemeIcon />
            {themeLabel}
          </button>
          <button className="nav-item" onClick={onLogout}>
            <LogOut />
            Salir
          </button>
        </div>
      </div>
    </aside>
  )
}
