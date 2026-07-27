import { BookOpen, Flame, LogOut, Moon, Sun } from "lucide-react"
import { NavLink } from "react-router-dom"
import { CourseIcon } from "@/components/course-icon"
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Sidebar as SidebarRoot,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import type { Course } from "@/types/database"

// La ruta activa la marca `NavLink` con aria-current="page"; el estilo cuelga de ahí en vez de
// pasarle `isActive` al botón, que obligaría a recalcular el match acá.
const ACTIVE =
  "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground"

// Lo que solo tiene sentido con el sidebar abierto: en el rail de iconos no hay ancho para texto.
const EXPANDED_ONLY = "group-data-[collapsible=icon]:hidden"

// Sidebar del diseño: nav de 2 items + cursos activos + racha al pie. Colapsable a rail de iconos
// (chrome mínimo, ui-principles #3). El estado colapsado lo controla App.
export function Sidebar({
  courses,
  streak,
  dark,
  onToggleTheme,
  onLogout,
}: {
  courses: Course[]
  streak: number
  dark: boolean
  onToggleTheme: () => void
  onLogout: () => void
}) {
  const active = courses.filter((c) => c.status === "active")
  const ThemeIcon = dark ? Sun : Moon
  const themeLabel = dark ? "Tema claro" : "Tema oscuro"

  return (
    <SidebarRoot collapsible="icon">
      <SidebarHeader className="flex-row items-center justify-between gap-0 pt-4 pr-2 pb-2 pl-4 group-data-[collapsible=icon]:px-2">
        <span className={`text-base font-semibold tracking-tight ${EXPANDED_ONLY}`}>Bitácora</span>
        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Hoy" className={ACTIVE}>
                <NavLink to="/" end>
                  <Flame />
                  <span>Hoy</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Cursos" className={ACTIVE}>
                <NavLink to="/courses">
                  <BookOpen />
                  <span>Cursos</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {active.length > 0 && (
          // `min-h-0` para que este grupo sea el que se achica y scrollea: sin eso el footer
          // (racha, tema, salir) se va abajo del viewport cuando hay muchos cursos.
          <SidebarGroup className="min-h-0 overflow-y-auto">
            <SidebarGroupLabel className="eyebrow">Cursos activos</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {active.map((c) => (
                  <SidebarMenuItem key={c.id}>
                    <SidebarMenuButton asChild size="sm" tooltip={c.name} className={ACTIVE}>
                      <NavLink to={`/course/${c.id}`}>
                        <CourseIcon icon={c.icon} />
                        <span>{c.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="gap-0 border-t p-2">
        <div className={`flex items-center gap-2 px-2 pt-1 ${EXPANDED_ONLY}`}>
          <Flame size={14} className="text-brand-fg" />
          <span className="mono">
            {streak} {streak === 1 ? "día" : "días"} de racha
          </span>
        </div>
        <div className={`flex items-center justify-between px-2 pt-2 pb-1.5 ${EXPANDED_ONLY}`}>
          <span className="mono-dim">⌘K comandos</span>
          <span className="mono-dim">? atajos</span>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onToggleTheme} tooltip={themeLabel}>
              <ThemeIcon />
              <span>{themeLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout} tooltip="Salir">
              <LogOut />
              <span>Salir</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </SidebarRoot>
  )
}
