// Última forma vista de cada pantalla (cuántos hábitos, filas, qué grupos del sidebar estaban
// abiertos), para que los skeletons dibujen lo que va a haber y no salte el layout al cargar.
// Un solo objeto en una sola key: agregar un campo es tocar `Sample` y `DEFAULTS`, nada más.
// Es solo una pista, así que si el JSON está roto o vacío se cae a los defaults.
type SidebarGroup = { rows: number; open: boolean }
type Sample = {
  habits: number
  notebooks: number
  sidebar: Record<"pinned" | "active" | "recent", SidebarGroup>
}

const KEY = "bitacora:sample"
const DEFAULTS: Sample = {
  habits: 3,
  notebooks: 6,
  sidebar: {
    pinned: { rows: 0, open: true },
    active: { rows: 4, open: true },
    recent: { rows: 0, open: false },
  },
}

export function readSample(): Sample {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }
  } catch {
    return DEFAULTS
  }
}

export function saveSample(patch: Partial<Sample>) {
  localStorage.setItem(KEY, JSON.stringify({ ...readSample(), ...patch }))
}

// Debug: `localStorage.setItem("bitacora:debug-loading", "1")` + recargar deja los skeletons fijos.
export const forceLoading = () => localStorage.getItem("bitacora:debug-loading") === "1"
