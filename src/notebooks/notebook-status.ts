import type { NotebookStatus } from "@/core/types/database"

// Etiqueta + color de texto por estado (chip neutro de la tabla) y color del dot (cards).
// Ámbar = única excepción categórica a "monocromo + una señal" (ADR 0023): solo texto y dot.
export const STATUS: Record<NotebookStatus, { label: string; cls: string }> = {
  active: { label: "activo", cls: "text-signal" },
  paused: { label: "pausado", cls: "text-warning" },
  done: { label: "hecho", cls: "text-muted-foreground" },
}

export const STATUS_DOT: Record<NotebookStatus, string> = {
  active: "bg-signal",
  paused: "bg-warning",
  done: "bg-muted-foreground",
}
