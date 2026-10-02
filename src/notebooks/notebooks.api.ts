import { toast } from "sonner"
import { store } from "@/core/store"
import {
  notebooksPage,
  liveNotebooks,
  type NotebooksQuery as DeriveQuery,
} from "@/core/store/derive"
import { useSnapshot, useSnapshotMutation } from "@/core/lib/snapshot"
import type { NotebookInput } from "@/core/store/types"
import type { Notebook as NotebookRow, NotebookStatus } from "@/core/types/database"

export const PAGE_SIZE = 24

// Payload del toggle "Marcar finalizado / Reabrir notebook", compartido por el sidebar y la
// pantalla Notebook. Reabrir limpia `finished_at` — si no, un notebook activo quedaría con fecha de fin.
export function toggleNotebookDone(notebook: NotebookRow): NotebookInput & { id: string } {
  const done = notebook.status === "done"
  return done
    ? { id: notebook.id, status: "active" as NotebookStatus, finished_at: null }
    : { id: notebook.id, status: "done" as NotebookStatus, finished_at: new Date().toISOString() }
}

// El tamaño de página lo fija la app, no la pantalla: la query de la UI son los cuatro filtros.
export type NotebooksQuery = Omit<DeriveQuery, "pageSize">

// Una página de la lista de notebooks. Búsqueda, filtro, orden, rondas y últ. repaso salen de
// `derive.notebooksPage` sobre el snapshot — antes de la RPC `notebooks_page`, que sigue en la DB sin
// llamador. Cambiar de filtro ya no es otra query: es otro `select` sobre los mismos datos, así
// que el parpadeo a skeleton que `keepPreviousData` tapaba dejó de existir.
export function useNotebooksPage(query: NotebooksQuery) {
  return useSnapshot((snap) => notebooksPage(snap, { ...query, pageSize: PAGE_SIZE }))
}

// Lista de notebooks vivos. Orden estable: active → paused → done, luego más nuevo primero.
export function useNotebooks() {
  return useSnapshot(liveNotebooks)
}

export function useCreateNotebook() {
  return useSnapshotMutation((input: NotebookInput & { name: string }) =>
    store.save("notebooks", input),
  )
}

export function useUpdateNotebook() {
  return useSnapshotMutation((input: NotebookInput & { id: string }) =>
    store.save("notebooks", input),
  )
}

// Soft delete (ADR 0002). No toca las notas del notebook.
export function useDeleteNotebook() {
  return useSnapshotMutation((id: string) => store.softDelete("notebooks", id), {
    onSuccess: () => toast.success("Notebook borrado"),
  })
}
