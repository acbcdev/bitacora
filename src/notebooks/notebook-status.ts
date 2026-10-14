import type { NotebookStatus } from "@/core/types/database"

// Etiqueta + color de texto por estado (chip neutro de la tabla) y color del dot (cards).
// Ámbar = única excepción categórica a "monocromo + una señal" (ADR 0023): solo texto y dot.
export const STATUS: Record<NotebookStatus, [string, string]> = {
  active: ["activo", "text-signal"],
  paused: ["pausado", "text-warning"],
  done: ["hecho", "text-muted-foreground"],
}

export const STATUS_DOT: Record<NotebookStatus, string> = {
  active: "bg-signal",
  paused: "bg-warning",
  done: "bg-muted-foreground",
}
