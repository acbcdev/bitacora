import { useNavigate } from "react-router-dom"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import type { NotebookRow } from "@/core/types/database"

// Nav por teclado sobre la página actual: J/K (+ Left/Right) mueven la selección, Enter abre
// (mismo destino que el click), E edita, Delete/Backspace borra (misma confirmación de siempre).
// Pasarse del borde salta de página. enabled: !embed — dentro de Repaso esta lista es
// secundaria, J/K/Enter ya los usa la cola.
export function useNotebookHotkeys({
  embed,
  rows,
  selected,
  page,
  pages,
  goToPage,
  setSelected,
  setEditing,
  setConfirmingDelete,
}: {
  embed?: boolean
  rows: NotebookRow[]
  selected: number
  page: number
  pages: number
  goToPage: (p: number) => void
  setSelected: (update: (i: number) => number) => void
  setEditing: (n: NotebookRow) => void
  setConfirmingDelete: (n: NotebookRow) => void
}) {
  const navigate = useNavigate()

  useSafeHotkeys(
    "j,left",
    () => {
      if (selected === 0 && page > 1) return goToPage(page - 1)
      setSelected((i) => Math.max(i - 1, 0))
    },
    { preventDefault: true, enabled: !embed },
    [selected, page, goToPage, rows.length],
  )
  useSafeHotkeys(
    "k,right",
    () => {
      if (selected === rows.length - 1 && page < pages) return goToPage(page + 1)
      setSelected((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)))
    },
    { preventDefault: true, enabled: !embed },
    [selected, rows.length, page, pages, goToPage],
  )
  useSafeHotkeys(
    "enter",
    () => rows[selected] && navigate(`/notebook/${rows[selected].id}`),
    { preventDefault: true, enabled: !embed },
    [rows, selected, navigate],
  )
  useSafeHotkeys(
    "e",
    () => rows[selected] && setEditing(rows[selected]),
    { preventDefault: true, enabled: !embed },
    [rows, selected],
  )
  useSafeHotkeys(
    "backspace,delete",
    () => rows[selected] && setConfirmingDelete(rows[selected]),
    { preventDefault: true, enabled: !embed },
    [rows, selected],
  )
}
