import { useState } from "react"
import {
  BookOpen,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Flame,
  LogOut,
  Moon,
  MoreHorizontal,
  Pin,
  PinOff,
  RotateCcw,
  Sun,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { CourseIcon } from "@/courses/course-icon"
import { useUpdateCourse } from "@/courses/courses.api"
import { togglePinnedCourse, usePinnedCourseIds } from "@/courses/pinned-courses"
import { Button } from "@/core/ui/button"
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

// Fila del sidebar: más alta y con texto más grande que el default del registry (h-8/text-sm).
// El `size-8!` del modo colapsado gana igual, así que el rail de iconos no cambia.
const ROW = "h-10 text-base [&_svg]:size-5"

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
              <SidebarMenuButton asChild tooltip="Hoy" className={`${ROW} ${ACTIVE}`}>
                <NavLink to="/" end>
                  <Flame />
                  <span>Hoy</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Cursos" className={`${ROW} ${ACTIVE}`}>
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

// Fila de curso dentro de un CourseGroup: pin y menú aparecen al hover, y recién ahí el nombre
// cede ancho (`pr` sólo en hover). Con el `pr-8` fijo de SidebarMenuAction el nombre se truncaba
// siempre para reservarle lugar a un botón invisible.
function CourseMenuItem({ course, pinned }: { course: Course; pinned: boolean }) {
  const updateCourse = useUpdateCourse()
  const done = course.status === "done"

  return (
    <SidebarMenuItem>
      {/* `hidden: false` pisa el default de SidebarMenuButton (tooltip sólo con sidebar colapsado):
          acá el nombre del curso se trunca también estando abierto, así que el tooltip hace falta. */}
      <SidebarMenuButton
        asChild
        tooltip={{ children: course.name, hidden: false }}
        className={`${ROW} ${ACTIVE} transition-none group-focus-within/menu-item:pr-15 group-hover/menu-item:pr-15 group-has-data-[state=open]/menu-item:pr-15`}
      >
        <NavLink to={`/course/${course.id}`}>
          <CourseIcon icon={course.icon} className="size-5" />
          <span>{course.name}</span>
        </NavLink>
      </SidebarMenuButton>
      {/* `data-[state=open]` mantiene las acciones visibles mientras el menú está abierto: si no,
          al mover el mouse al dropdown la fila pierde el hover y los botones desaparecen. */}
      <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 opacity-0 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 group-has-data-[state=open]/menu-item:opacity-100 group-data-[collapsible=icon]:hidden">
        <Button
          variant="ghost"
          size="icon-xs"
          className="[&_svg]:size-4"
          aria-label={pinned ? `Desfijar ${course.name}` : `Fijar ${course.name}`}
          onClick={() => togglePinnedCourse(course.id)}
        >
          {pinned ? <PinOff /> : <Pin />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="[&_svg]:size-4"
              aria-label={`Acciones de ${course.name}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-52">
            <DropdownMenuItem onSelect={() => togglePinnedCourse(course.id)}>
              {pinned ? <PinOff /> : <Pin />}
              {pinned ? "Desfijar" : "Fijar"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                updateCourse.mutate(
                  done
                    ? { id: course.id, status: "active", finished_at: null }
                    : { id: course.id, status: "done", finished_at: new Date().toISOString() },
                )
              }
            >
              {done ? <RotateCcw /> : <Check />}
              {done ? "Reabrir curso" : "Marcar finalizado"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SidebarMenuItem>
  )
}
