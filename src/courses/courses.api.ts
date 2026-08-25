import { toast } from "sonner"
import { store } from "@/core/store"
import { coursesPage, liveCourses, type CoursesQuery as DeriveQuery } from "@/core/store/derive"
import { useSnapshot, useSnapshotMutation } from "@/core/lib/snapshot"
import type { CourseInput } from "@/core/store/types"

export const PAGE_SIZE = 24

// El tamaño de página lo fija la app, no la pantalla: la query de la UI son los cuatro filtros.
export type CoursesQuery = Omit<DeriveQuery, "pageSize">

// Una página de la lista de cursos. Búsqueda, filtro, orden, rondas y últ. repaso salen de
// `derive.coursesPage` sobre el snapshot — antes de la RPC `courses_page`, que sigue en la DB sin
// llamador. Cambiar de filtro ya no es otra query: es otro `select` sobre los mismos datos, así
// que el parpadeo a skeleton que `keepPreviousData` tapaba dejó de existir.
export function useCoursesPage(query: CoursesQuery) {
  return useSnapshot((snap) => coursesPage(snap, { ...query, pageSize: PAGE_SIZE }))
}

// Lista de cursos vivos. Orden estable: active → paused → done, luego más nuevo primero.
export function useCourses() {
  return useSnapshot(liveCourses)
}

export function useCreateCourse() {
  return useSnapshotMutation((input: CourseInput & { name: string }) =>
    store.save("courses", input),
  )
}

export function useUpdateCourse() {
  return useSnapshotMutation((input: CourseInput & { id: string }) => store.save("courses", input))
}

// Soft delete (ADR 0002). No toca las notas del curso.
export function useDeleteCourse() {
  return useSnapshotMutation((id: string) => store.softDelete("courses", id), {
    onSuccess: () => toast.success("Curso borrado"),
  })
}
