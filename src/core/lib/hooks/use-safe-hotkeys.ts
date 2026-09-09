import { useEffect, useState } from "react"
import { useHotkeys, type Options } from "react-hotkeys-hook"

// Wrapper sobre react-hotkeys-hook que bloquea el atajo cuando el foco está
// dentro de un overlay modal (Dialog/AlertDialog/Drawer) o cuando cualquier
// dialog está abierto (Radix porteado). Es el fix al leak de Enter de Repaso
// dentro de HabitsDialog/NotebookForm sin MutationObserver pesado.
function useIsBlocked(): boolean {
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    const check = () => {
      const el = document.activeElement as HTMLElement | null
      const inOverlay = !!el?.closest(
        '[role="dialog"], [role="alertdialog"], [data-slot="drawer-content"], [data-slot="dialog-content"]',
      )
      // Fallback por si el foco aún está en el trigger (1 frame después de abrir)
      const anyOpen = !!document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      )
      setBlocked((prev) => {
        const next = inOverlay || anyOpen
        return prev === next ? prev : next
      })
    }
    check()
    document.addEventListener("focusin", check)
    document.addEventListener("focusout", check)
    // Solo data-state, no class/style -> evita el freeze anterior
    const obs = new MutationObserver(check)
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    })
    return () => {
      obs.disconnect()
      document.removeEventListener("focusin", check)
      document.removeEventListener("focusout", check)
    }
  }, [])
  return blocked
}

export function useSafeHotkeys(
  keys: string,
  callback: (e: KeyboardEvent) => void,
  options?: Options,
  deps?: unknown[],
) {
  const blocked = useIsBlocked()
  const enabled = (options?.enabled ?? true) && !blocked
  return useHotkeys(keys, callback, { ...options, enabled }, deps as never)
}
