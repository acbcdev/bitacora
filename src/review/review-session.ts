import { useCallback, useEffect, useState } from "react"
import type { Grade } from "@/core/types/database"
import type { NoteRef } from "@/core/store/types"
import { EMPTY_READ_STATS, readStats } from "@/core/store/derive"
import { useSnapshot } from "@/core/lib/snapshot"
import { useMarkRead, useReviewQueue } from "@/review/review.api"
import { useNote } from "@/notes/notes.api"

export type ReviewSession = {
  readonly item: NoteRef | null
  readonly position: string // "i / vistas" | "" si vistas ≤ 1 o done
  readonly index: number
  readonly length: number
  readonly done: boolean
  readonly revealed: boolean
  readonly marked: boolean
  readonly reads: number // stats.byNote.get(item.id)?.count
  reveal(): void
  mark(grade?: Grade): void // idempotente por markedIds interno
  next(): void
  prev(): void
}

export function useReviewSession(): ReviewSession {
  const { data: derived = [] } = useReviewQueue()
  const { data: stats = EMPTY_READ_STATS } = useSnapshot((s) => readStats(s))
  const markRead = useMarkRead()

  const [frozen, setFrozen] = useState<NoteRef[]>([])
  // vistas = max + 1: con la cola congelada, el índice más alto alcanzado basta (ADR 0025).
  // Juntos en un estado: next() sube los dos en el mismo update.
  const [{ index, max }, setCursor] = useState({ index: 0, max: 0 })
  const [revealed, setRevealed] = useState(false)
  const [markedIds, setMarkedIds] = useState<ReadonlySet<string>>(() => new Set<string>())

  useEffect(() => {
    setFrozen((prev) => (prev.length === 0 && derived.length > 0 ? derived : prev))
  }, [derived])

  useEffect(() => {
    setRevealed(false)
  }, [index])

  const item = frozen[index] ?? null
  // Prefetch de la siguiente (una sola adelante, misma query ["note", id]). No toca vistas.
  useNote(frozen[index + 1]?.id)
  const done = frozen.length === 0 || index >= frozen.length
  const position = done || max === 0 ? "" : `${index + 1} / ${max + 1}`
  const marked = !!item && markedIds.has(item.id)
  const reads = item ? (stats.byNote.get(item.id)?.count ?? 0) : 0

  const reveal = useCallback(() => {
    if (item) setRevealed(true)
  }, [item])

  const mark = useCallback(
    (grade?: Grade) => {
      if (!item || marked) return
      markRead.mutate({ noteId: item.id, grade })
      setMarkedIds((ids) => new Set(ids).add(item.id))
    },
    [item, marked, markRead],
  )

  const next = useCallback(() => {
    setCursor((c) => {
      const i = Math.min(c.index + 1, frozen.length)
      // El fin de cola (i = length) no es una nota vista.
      return { index: i, max: Math.max(c.max, Math.min(i, frozen.length - 1)) }
    })
  }, [frozen])

  const prev = useCallback(() => {
    setCursor((c) => ({ ...c, index: Math.max(c.index - 1, 0) }))
  }, [])

  return {
    item,
    position,
    index,
    length: frozen.length,
    done,
    revealed,
    marked,
    reads,
    reveal,
    mark,
    next,
    prev,
  }
}
