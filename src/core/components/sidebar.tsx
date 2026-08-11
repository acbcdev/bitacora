import { useState } from "react"
import {
  BookOpen,
  ChevronRight,
  ChevronsUpDown,
  Flame,
  LogOut,
  Moon,
  Pin,
  PinOff,
  Sun,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { CourseIcon } from "@/courses/course-icon"
import { togglePinnedCourse, usePinnedCourseIds } from "@/courses/pinned-courses"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/core/ui/collapsible"
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
  SidebarMenuAction,
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
  const pinnedIds = usePinnedCourseIds()
  // Cada curso vive en un solo grupo: fijado gana sobre activo, activo sobre reciente — sin eso
  // el mismo curso aparecería duplicado en dos secciones.
  const pinned = courses.filter((c) => pinnedIds.includes(c.id))
  const active = courses.filter((c) => c.status === "active" && !pinnedIds.includes(c.id))
  // Mismo criterio que el sort "Recientes" de /courses (started_at desc, ver migración 0009),
  // acá recortado a un puñado.
  const recent = courses
    .filter((c) => c.status !== "active" && !pinnedIds.includes(c.id))
    .toSorted((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""))
    .slice(0, 5)
  const [fijadoOpen, setFijadoOpen] = useState(true)
  const [activosOpen, setActivosOpen] = useState(true)
  const [recientesOpen, setRecientesOpen] = useState(false)
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

        {/* `min-h-0` para que este bloque sea el que se achica y scrollea: sin eso el footer
            (menú de cuenta) se va abajo del viewport cuando hay muchos cursos. */}
        <div className="flex min-h-0 flex-col overflow-y-auto">
          <CourseGroup
            label="Fijado"
            courses={pinned}
            pinned
            open={fijadoOpen}
            onOpenChange={setFijadoOpen}
          />
          <CourseGroup
            label="Activos"
            courses={active}
            pinned={false}
            open={activosOpen}
            onOpenChange={setActivosOpen}
          />
          <CourseGroup
            label="Recientes"
            courses={recent}
            pinned={false}
            open={recientesOpen}
            onOpenChange={setRecientesOpen}
          />
        </div>
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

// Un grupo colapsable de cursos (Fijado/Activos/Recientes) — mismo shell para los tres, cambia
// la lista y si el ítem ya está fijado (para mostrar Pin o PinOff). Vacío no renderiza nada.
function CourseGroup({
  label,
  courses,
  pinned,
  open,
  onOpenChange,
}: {
  label: string
  courses: Course[]
  pinned: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (courses.length === 0) return null

  return (
    <SidebarGroup className="pb-0">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel asChild className="eyebrow cursor-pointer">
            <button type="button">
              <ChevronRight
                size={12}
                className={`mr-1 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
              />
              {label}
            </button>
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {courses.map((c) => (
                <CourseMenuItem key={c.id} course={c} pinned={pinned} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  )
}

// Fila de curso dentro de un CourseGroup: el botón de pin sólo aparece al hover (showOnHover),
// como el resto de las acciones por fila del resto de la app.
function CourseMenuItem({ course, pinned }: { course: Course; pinned: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild size="sm" tooltip={course.name} className={ACTIVE}>
        <NavLink to={`/course/${course.id}`}>
          <CourseIcon icon={course.icon} />
          <span>{course.name}</span>
        </NavLink>
      </SidebarMenuButton>
      <SidebarMenuAction
        showOnHover
        type="button"
        aria-label={pinned ? `Desfijar ${course.name}` : `Fijar ${course.name}`}
        onClick={() => togglePinnedCourse(course.id)}
      >
        {pinned ? <PinOff size={13} /> : <Pin size={13} />}
      </SidebarMenuAction>
    </SidebarMenuItem>
  )
}
