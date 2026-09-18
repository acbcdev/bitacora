import type { NotebookStatus } from "@/core/types/database"

// Etiqueta + variante de badge por estado (tabla) y color del dot (cards).
export const STATUS: Record<NotebookStatus, [string, "brand" | "warning" | "outline"]> = {
  active: ["activo", "brand"],
  paused: ["pausado", "warning"],
  done: ["hecho", "outline"],
}

export const STATUS_DOT: Record<NotebookStatus, string> = {
  active: "bg-brand",
  paused: "bg-warning",
  done: "bg-muted-foreground",
}
