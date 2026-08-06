import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/core/lib/supabase"
import type { Course, CourseRow, CourseStatus } from "@/core/types/database"

const STATUS_ORDER: Record<CourseStatus, number> = { active: 0, paused: 1, done: 2 }

export const PAGE_SIZE = 24

export type CoursesQuery = {
  q: string
  status: CourseStatus | "todos"
  sort: "recientes" | "nombre" | "rondas" | "inicio"
  page: number
}

// Una página de la lista de cursos (RPC courses_page, migración 0006). Búsqueda, filtro de
// estado, orden, rondas y últ. repaso resueltos en Postgres — el cliente no agrega nada.
// Cada cambio de filtro es otra query: la queryKey lleva los cuatro parámetros.
export function useCoursesPage({ q, status, sort, page }: CoursesQuery) {
  return useQuery({
    // Prefijo ["courses"]: el invalidateQueries de las mutaciones ya matchea por prefijo, así que
    // crear/editar/borrar refresca la página actual sin tocar nada más.
    queryKey: ["courses", "page", q, status, sort, page],
    // Sin esto la lista parpadea a skeleton en cada tecla del buscador y en cada cambio de página.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ rows: CourseRow[]; total: number }> => {
      const { data, error } = await supabase.rpc("courses_page", {
        q,
        status_filter: status === "todos" ? null : status,
        sort,
        page_size: PAGE_SIZE,
        page_offset: (page - 1) * PAGE_SIZE,
      })
      if (error) throw error
      // total_count viaja repetido en cada fila; sin filas, no hay resultados.
      return { rows: data, total: data[0]?.total_count ?? 0 }
    },
  })
}

// Lista de cursos vivos. Orden estable: active → paused → done, luego más nuevo primero.
// Datos chicos → ordeno en JS (Postgres no ordena por prioridad de enum sin CASE).
export function useCourses() {
  return useQuery({
    queryKey: ["courses"],
    queryFn: async (): Promise<Course[]> => {
      const { data, error } = await supabase.from("courses").select("*").is("deleted_at", null)
      if (error) throw error
      return data.toSorted(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          b.created_at.localeCompare(a.created_at),
      )
    },
  })
}

// El progreso por curso lo trae `courses_page` (columna `notes`) — la RPC `course_progress`
// sigue en la DB pero ya no la llama nadie.

// Parcial: crear solo manda nombre + inicio (status lo pone el default de la DB), y
// "Finalizar" solo manda status + fin.
type CourseInput = {
  name?: string
  status?: CourseStatus
  started_at?: string | null
  finished_at?: string | null
  icon?: string | null
  source?: string | null
  area?: string | null
}

// Sube el icono y devuelve su URL pública. La carpeta tiene que ser el user_id: es lo que
// exige la policy de storage (migración 0004). El tipo y el tamaño los valida el bucket.
export async function uploadCourseIcon(file: File) {
  const { data, error: authError } = await supabase.auth.getUser()
  if (authError || !data.user) throw authError ?? new Error("Sin sesión")
  // Sin extensión: el content-type lo guarda storage, y así no hay que sanear `file.name`.
  const path = `${data.user.id}/${crypto.randomUUID()}`
  const { error } = await supabase.storage.from("course-icons").upload(path, file)
  if (error) throw error
  return supabase.storage.from("course-icons").getPublicUrl(path).data.publicUrl
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CourseInput & { name: string }) => {
      const { error } = await supabase.from("courses").insert(input) // user_id: DB default auth.uid()
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  })
}

export function useUpdateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: CourseInput & { id: string }) => {
      const { error } = await supabase.from("courses").update(input).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  })
}

// Soft delete: set deleted_at. NUNCA DELETE (ADR 0002). No toca las notas del curso.
export function useDeleteCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("courses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Curso borrado")
      qc.invalidateQueries({ queryKey: ["courses"] })
    },
  })
}
