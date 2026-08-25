import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { store } from "@/core/store"
import type { CourseInput, CoursesQuery as StoreQuery } from "@/core/store/types"

export const PAGE_SIZE = 24

// El tamaño de página lo fija la app, no la pantalla: la query de la UI son los cuatro filtros.
export type CoursesQuery = Omit<StoreQuery, "pageSize">

// Una página de la lista de cursos. Búsqueda, filtro de estado, orden, rondas y últ. repaso los
// resuelve el adapter — en Supabase con la RPC `courses_page`, en local con `derive.coursesPage`.
// Cada cambio de filtro es otra query: la queryKey lleva los cuatro parámetros.
export function useCoursesPage({ q, status, sort, page }: CoursesQuery) {
  return useQuery({
    // Prefijo ["courses"]: el invalidateQueries de las mutaciones ya matchea por prefijo, así que
    // crear/editar/borrar refresca la página actual sin tocar nada más.
    queryKey: ["courses", "page", q, status, sort, page],
    // Sin esto la lista parpadea a skeleton en cada tecla del buscador y en cada cambio de página.
    placeholderData: keepPreviousData,
    queryFn: () => store.coursesPage({ q, status, sort, page, pageSize: PAGE_SIZE }),
  })
}

// Lista de cursos vivos. Orden estable: active → paused → done, luego más nuevo primero.
export function useCourses() {
  return useQuery({ queryKey: ["courses"], queryFn: () => store.listCourses() })
}

// El progreso por curso lo trae `coursesPage` (columna `notes`) — la RPC `course_progress`
// sigue en la DB pero ya no la llama nadie.

// Sube el icono y devuelve su URL. En Supabase va al bucket `course-icons`; en local es una data
// URL — `CourseIcon` ya trata cualquier cosa que no empiece con 'lucide:' como imagen.
export const uploadCourseIcon = (file: File) => store.uploadCourseIcon(file)

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CourseInput & { name: string }) => store.createCourse(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  })
}

export function useUpdateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: CourseInput & { id: string }) => store.updateCourse(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  })
}

// Soft delete (ADR 0002). No toca las notas del curso.
export function useDeleteCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => store.deleteCourse(id),
    onSuccess: () => {
      toast.success("Curso borrado")
      qc.invalidateQueries({ queryKey: ["courses"] })
    },
  })
}
