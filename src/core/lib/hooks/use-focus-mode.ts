import { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

// Seam de focus mode (review de arquitectura 2026-09-23, ADR 0012 para Repaso): una sola fuente
// de verdad. Este hook es dueño del state, del param `?focus=1` en la URL y del fullscreen
// nativo; las pantallas (Shell, Notebook, Note, Repaso) cruzan la misma interface y nadie más
// conoce los mecanismos.
//
// ¿Por qué la URL es fuente de verdad? Navegar de pantalla sale del modo (comportamiento
// esperado), pero Repaso también abre una nota ya en focus SIN gesto (menú de acciones):
// requestFullscreen exige gesto y la promesa rechaza — el layout sin chrome queda igual
// (mejor-effort).
export function useFocusMode() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [focus, setFocus] = useState(() => new URLSearchParams(search).has("focus"))

  // La URL manda en cada navegación (igual que antes): cambiar de pantalla apaga, salvo que la
  // nueva URL traiga `?focus=1`.
  useEffect(() => setFocus(new URLSearchParams(search).has("focus")), [pathname, search])

  // Fullscreen nativo mejor-effort (ponytail: sin prefijos webkit, Safari 16.4+ va sin ellos).
  // requestFullscreen exige gesto del usuario: sin él la promesa rechaza, catch y el layout
  // sin chrome queda igual. Esc del browser dispara fullscreenchange y apaga el modo.
  useEffect(() => {
    if (focus) document.documentElement.requestFullscreen().catch(() => {})
    else if (document.fullscreenElement) void document.exitFullscreen()

    function sync() {
      if (!document.fullscreenElement) setFocus(false)
    }
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [focus])

  const enter = useCallback(() => navigate({ pathname, search: "?focus=1" }), [navigate, pathname])
  const exit = useCallback(() => {
    navigate({ pathname, search: "" })
  }, [navigate, pathname])

  return { focus, enter, exit }
}

// Inyector de foco para navegaciones cross-screen (Repaso › nota: el focus se activa con la
// URL; la pantalla destino lo lee con useFocusMode). El string del param vive acá, no en cada caller.
export function focusHref(pathname: string) {
  return `${pathname}?focus=1`
}
