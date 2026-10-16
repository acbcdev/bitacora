import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import type { NotebookRow } from "@/core/types/database"

// Nav por teclado sobre la página actual: J/K (+ Left/Right) mueven la selección, Enter abre
// (mismo destino que el click), E edita, Delete/Backspace borra (misma confirmación de siempre).
// Pasarse del borde salta de página. enabled: dentro de Repaso ←/→/Enter los comparte con la cola,
// Review decide quién los tiene según qué sección se ve más.
// El cursor arranca oculto: la primera flecha sólo lo muestra (sin moverlo) y hasta entonces
// Enter/E/Delete no actúan — nada de abrir o borrar un notebook que no se ve seleccionado.
export function useNotebookHotkeys({
  enabled,
  rows,
  selected,
  page,
  pages,
  goToPage,
  setSelected,
  setEditing,
  setConfirmingDelete,
}: {
  enabled: boolean
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
  const [shown, setShown] = useState(false)
  // Perder las teclas (en Repaso: la cola pasó a verse más) vuelve a ocultar el cursor.
  // setState en render, no effect: se corrige antes de pintar, sin un frame con el outline.
  if (!enabled && shown) setShown(false)
  const current = shown ? rows[selected] : undefined

  useSafeHotkeys(
    "j,left",
    () => {
      if (!shown) return setShown(true)
      if (selected === 0 && page > 1) return goToPage(page - 1)
      setSelected((i) => Math.max(i - 1, 0))
    },
    { preventDefault: true, enabled },
    [shown, selected, page, goToPage, rows.length],
  )
  useSafeHotkeys(
    "k,right",
    () => {
      if (!shown) return setShown(true)
      if (selected === rows.length - 1 && page < pages) return goToPage(page + 1)
      setSelected((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)))
    },
    { preventDefault: true, enabled },
    [shown, selected, rows.length, page, pages, goToPage],
  )
  useSafeHotkeys(
    "enter",
    () => current && navigate(`/notebook/${current.id}`),
    { preventDefault: true, enabled },
    [current, navigate],
  )
  useSafeHotkeys("e", () => current && setEditing(current), { preventDefault: true, enabled }, [
    current,
  ])
  useSafeHotkeys(
    "backspace,delete",
    () => current && setConfirmingDelete(current),
    { preventDefault: true, enabled },
    [current],
  )

  return shown
}
