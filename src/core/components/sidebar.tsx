import { BookOpen, ChevronsUpDown, Flame, LogOut, Moon, Sun } from "lucide-react"
import { NavLink } from "react-router-dom"
import { CourseIcon } from "@/courses/course-icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
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
} from "@/core/ui/sidebar"
import type { Course } from "@/core/types/database"

// La ruta activa la marca `NavLink` con aria-current="page"; el estilo cuelga de ahí en vez de
// pasarle `isActive` al botón, que obligaría a recalcular el match acá.
const ACTIVE =
  "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground"

// Lo que solo tiene sentido con el sidebar abierto: en el rail de iconos no hay ancho para texto.
const EXPANDED_ONLY = "group-data-[collapsible=icon]:hidden"

// Sidebar del diseño: nav de 2 items + cursos activos + menú de cuenta al pie. Colapsable a rail de
// iconos (chrome mínimo, ui-principles #3). El estado colapsado lo controla App.
export function Sidebar({
  courses,
  email,
  dark,
  onToggleTheme,
  onLogout,
}: {
  courses: Course[]
  email: string
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
          // (menú de cuenta) se va abajo del viewport cuando hay muchos cursos.
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

      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip={email}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent font-medium uppercase">
                    {email.charAt(0)}
                  </span>
                  <span className="truncate">{email}</span>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              {/* Se abre hacia arriba/al lado según el lado libre: al pie del sidebar no hay espacio abajo. */}
              <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
                <DropdownMenuItem onClick={onToggleTheme}>
                  <ThemeIcon />
                  {themeLabel}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut />
                  Salir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </SidebarRoot>
  )
}
