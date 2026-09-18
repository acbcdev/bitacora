import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { NotebookCard } from "@/notebooks/notebook-card"
import { NotebookDeleteConfirm } from "@/notebooks/notebook-delete-confirm"
import { NotebookEmpty } from "@/notebooks/notebook-empty"
import { NotebookForm } from "@/notebooks/notebook-form"
import { useNotebookFilters } from "@/notebooks/notebook-filters"
import { useNotebookHotkeys } from "@/notebooks/notebook-hotkeys"
import { NotebookPagination } from "@/notebooks/notebook-pagination"
import { NotebookTable } from "@/notebooks/notebook-table"
import { NotebookToolbar } from "@/notebooks/notebook-toolbar"
import { TableSkeleton } from "@/core/components/skeletons"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import { PAGE_SIZE, useNotebooksPage, useDeleteNotebook } from "@/notebooks/notebooks.api"
import type { Notebook, NotebookRow } from "@/core/types/database"

// Pantalla Notebooks (screen 2) como database view del diseño: buscar, filtrar por estado, ordenar,
// y alternar tabla / tarjetas. Búsqueda, filtro, orden y paginado los resuelve la RPC
// `notebooks_page` (migración 0006) — el cliente sólo guarda el estado de los controles.
export function Notebooks({ embed }: { embed?: boolean }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const del = useDeleteNotebook()
  const isMobile = useIsMobile()

  const [view, setView] = useState<"tabla" | "tarjetas">("tarjetas")
  const [editing, setEditing] = useState<Notebook | null | "new">(params.get("new") ? "new" : null)
  const [confirmingDelete, setConfirmingDelete] = useState<NotebookRow | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filters = useNotebookFilters(searchRef)

  const { data, isLoading } = useNotebooksPage({
    q: filters.debouncedQ,
    status: filters.status,
    sort: filters.sort,
    page: filters.page,
  })
  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1)
  // Distingue "todavía no creaste ningún notebook" de "los filtros no matchean nada": con paginado
  // en server no hay una lista completa en cliente contra la cual comparar.
  const filtering = !!filters.debouncedQ || filters.status !== "todos"

  // Borrar el último notebook de la última página la deja vacía: retroceder en vez de mostrar nada.
  useEffect(() => {
    if (filters.page > pages) filters.goToPage(pages)
  }, [filters, pages])

  useSafeHotkeys("n", () => setEditing("new"), { preventDefault: true })
  // "slash", no "/": la lib matchea por e.code (ver comentario de mod+slash en app.tsx).
  useSafeHotkeys("slash", () => searchRef.current?.focus(), {
    preventDefault: true,
    enabled: !embed,
  })

  useNotebookHotkeys({
    embed,
    rows,
    selected: filters.selected,
    page: filters.page,
    pages,
    goToPage: filters.goToPage,
    setSelected: filters.setSelected,
    setEditing,
    setConfirmingDelete,
  })

  function close() {
    setEditing(null)
    if (params.get("new")) setParams({}, { replace: true })
  }

  return (
    <div className={embed ? "fade-in" : "fade-in mx-auto max-w-shell px-4 pt-9 pb-16 sm:px-8"}>
      <div className="mb-6 flex items-baseline gap-3">
        <h1
          className={
            embed ? "text-xl font-semibold tracking-tight" : "text-2xl font-semibold tracking-tight"
          }
        >
          Notebooks
        </h1>
        <span className="mono-dim">
          {total} {total === 1 ? "notebook" : "notebooks"}
        </span>
      </div>

      <NotebookToolbar
        q={filters.q}
        onQ={filters.setQ}
        searchRef={searchRef}
        onSearchKey={filters.onSearchKey}
        status={filters.status}
        onStatus={filters.changeStatus}
        sort={filters.sort}
        onSort={filters.changeSort}
        view={view}
        onView={setView}
        onNew={() => setEditing("new")}
      />

      {isLoading ? (
        <TableSkeleton />
      ) : view === "tabla" && !isMobile ? (
        <NotebookTable
          rows={rows}
          selected={filters.selected}
          filtering={filtering}
          onOpen={(nb) => navigate(`/notebook/${nb.id}`)}
          onEdit={setEditing}
          onDelete={(id) => del.mutate(id)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c, i) => (
            <NotebookCard
              key={c.id}
              notebook={c}
              active={i === filters.selected}
              onOpen={(nb) => navigate(`/notebook/${nb.id}`)}
              onEdit={setEditing}
              onDelete={(id) => del.mutate(id)}
            />
          ))}
          {rows.length === 0 && <NotebookEmpty filtering={filtering} />}
        </div>
      )}

      {pages > 1 && (
        <NotebookPagination page={filters.page} pages={pages} goToPage={filters.goToPage} />
      )}

      {editing && <NotebookForm notebook={editing === "new" ? null : editing} onClose={close} />}

      {/* Borrar por teclado (Delete/Backspace sobre la fila seleccionada) — separado del
          ConfirmDelete de RowActions, que ya cubre el flujo de mouse. */}
      <NotebookDeleteConfirm
        target={confirmingDelete}
        onConfirm={(id) => del.mutate(id)}
        onClose={() => setConfirmingDelete(null)}
      />
    </div>
  )
}
