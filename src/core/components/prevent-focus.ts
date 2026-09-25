import type { MouseEvent } from "react"

// Botones de overlay del editor (bubble de formato, controles de tabla): los clicks no
// sacan el foco de la selección — mousedown → preventDefault.
export function preventFocus(e: MouseEvent) {
  e.preventDefault()
}
