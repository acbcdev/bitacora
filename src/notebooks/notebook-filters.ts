import { useEffect, useState, type RefObject } from "react"
import type { NotebookStatus } from "@/core/types/database"

type Sort = "recientes" | "nombre" | "rondas" | "inicio"
export type { Sort }

// El buscador dispara una query por cambio: sin debounce sería una RPC por tecla.
const SEARCH_DEBOUNCE = 300

// Estado de los controles de la database view (búsqueda debounced, estado, orden, página y
// selección de teclado) con la regla de negocio: cambiar filtro/orden vuelve a la página 1
// y suelta la selección — la página vieja puede no existir en el resultado filtrado y la
// selección apuntaría a un notebook que ya no está.
export function useNotebookFilters(searchRef: RefObject<HTMLInputElement | null>) {
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [status, setStatus] = useState<NotebookStatus | "todos">("todos")
  const [sort, setSort] = useState<Sort>("recientes")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(0)

  // Al disparar la búsqueda por debounce (tipeo sin Enter) también vuelve a la página 1 y suelta
  // la selección — la lista filtrada puede tener otras páginas y otra fila bajo el mismo índice.
  // El timer re-armado tras cada debounce queda en no-op (q === debouncedQ).
  useEffect(() => {
    const t = setTimeout(() => {
      if (q !== debouncedQ) {
        setPage(1)
        setSelected(0)
      }
      setDebouncedQ(q)
    }, SEARCH_DEBOUNCE)
    return () => clearTimeout(t)
  }, [q, debouncedQ])

  // Enter dispara la búsqueda sin esperar el debounce; el timer pendiente después setea el
  // mismo valor y no hace nada. Escape limpia y desenfoca.
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") return changeQ(q)
    if (e.key !== "Escape") return
    if (q) setQ("")
    searchRef.current?.blur()
  }
  function changeQ(v: string) {
    setDebouncedQ(v)
    resetFilters()
  }
  function changeStatus(v: NotebookStatus | "todos") {
    setStatus(v)
    resetFilters()
  }
  function changeSort(v: Sort) {
    setSort(v)
    resetFilters()
  }
  function resetFilters() {
    setPage(1)
    setSelected(0)
  }
  // Navegar de página también suelta la selección: la fila i de la página nueva es otra.
  function goToPage(p: number) {
    setPage(p)
    setSelected(0)
  }

  return {
    q,
    setQ,
    onSearchKey,
    status,
    changeStatus,
    sort,
    changeSort,
    page,
    goToPage,
    selected,
    setSelected,
    debouncedQ,
  }
}
