import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Tamaños de la escala del DS (index.css) que tailwind-merge no conoce: sin esto `text-stat`
// se toma por un color y `cn("text-stat", "text-signal")` lo borra.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["2xs", "md", "display", "stat"] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Misma detección que react-hotkeys-hook para "mod": así el hint que mostramos es la tecla
// que realmente dispara el atajo.
export const isMac = (ua = typeof navigator === "undefined" ? "" : navigator.userAgent) =>
  /mac/i.test(ua) && !/iphone|ipad|ipod/i.test(ua)

export const MOD = isMac() ? "⌘" : "Ctrl"

export const mod = (key: string) => `${MOD}+${key}`
export const alt = (key: string) => `${isMac() ? "⌥" : "Alt"}+${key}`
