import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Misma detección que react-hotkeys-hook para "mod": así el hint que mostramos es la tecla
// que realmente dispara el atajo.
export const isMac = (ua = typeof navigator === "undefined" ? "" : navigator.userAgent) =>
  /mac/i.test(ua) && !/iphone|ipad|ipod/i.test(ua)

export const MOD = isMac() ? "⌘" : "Ctrl"

export const mod = (key: string) => `${MOD}+${key}`
