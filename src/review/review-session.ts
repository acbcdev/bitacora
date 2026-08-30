import { useCallback, useEffect, useRef, useState } from "react"
import type { Grade } from "@/core/types/database"
import type { NoteRef } from "@/core/store/types"
import { EMPTY_READ_STATS, readStats, type ReadStats } from "@/core/store/derive"
import { useSnapshot } from "@/core/lib/snapshot"
import { useMarkRead, useReviewQueue } from "@/review/review.api"

// Seam futuro para Cola one-by-one — hoy no se usa, pero existe para que
// intercalado + seen[] entren sin tocar JSX (ADR 0012).
// type QueueStrategy = (snap: Snapshot) => NoteRef[]

export type ReviewSession = {
  readonly item: NoteRef | null
  readonly position: string // "2 / 3" | "" si done
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
  loadMore(newQueue?: NoteRef[]): void // descongela — sin arg toma derived fresco (hook), con arg pura
}

export function createReviewSession(opts: {
  queue: NoteRef[]
  stats: ReadStats
  markRead: (noteId: string, grade?: Grade) => void
}): ReviewSession {
  let frozenQueue = [...opts.queue]
  let index = 0
  let revealed = false
  const markedIds = new Set<string>()
  const seen: string[] = [] // back-stack futuro para J, hoy solo push en next

  // void para no usar QueueStrategy aún — mantiene el seam visible sin especulación
  void seen

  return {
    get item(): NoteRef | null {
      return frozenQueue[index] ?? null
    },
    get position(): string {
      if (frozenQueue.length === 0 || index >= frozenQueue.length) return ""
      return `${index + 1} / ${frozenQueue.length}`
    },
    get index(): number {
      return index
    },
    get length(): number {
      return frozenQueue.length
    },
    get done(): boolean {
      return frozenQueue.length === 0 || index >= frozenQueue.length
    },
    get revealed(): boolean {
      return revealed
    },
    get marked(): boolean {
      const cur = frozenQueue[index]
      return !!cur && markedIds.has(cur.id)
    },
    get reads(): number {
      const cur = frozenQueue[index]
      if (!cur) return 0
      return opts.stats.byNote.get(cur.id)?.count ?? 0
    },
    reveal(): void {
      if (frozenQueue[index] && !revealed) revealed = true
    },
    mark(grade?: Grade): void {
      const cur = frozenQueue[index]
      if (!cur) return
      if (markedIds.has(cur.id)) return
      opts.markRead(cur.id, grade)
      markedIds.add(cur.id)
    },
    next(): void {
      const n = Math.min(index + 1, frozenQueue.length)
      if (n === index) return
      const cur = frozenQueue[index]
      if (cur) seen.push(cur.id)
      index = n
      revealed = false
    },
    prev(): void {
      const p = Math.max(index - 1, 0)
      if (p === index) return
      index = p
      revealed = false
    },
    loadMore(newQueue?: NoteRef[]): void {
      if (!newQueue) return
      frozenQueue = [...newQueue]
      index = 0
      revealed = false
    },
  }
}

export function useReviewSession(): ReviewSession {
  const { data: derived = [] } = useReviewQueue()
  const { data: stats = EMPTY_READ_STATS } = useSnapshot((s) => readStats(s))
  const markRead = useMarkRead()

  const [frozen, setFrozen] = useState<NoteRef[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [markedIds, setMarkedIds] = useState<ReadonlySet<string>>(() => new Set<string>())
  const seenRef = useRef<string[]>([])
  void seenRef

  useEffect(() => {
    setFrozen((prev) => (prev.length === 0 && derived.length > 0 ? derived : prev))
  }, [derived])

  useEffect(() => {
    setRevealed(false)
  }, [index])

  const item = frozen[index] ?? null
  const done = frozen.length === 0 || index >= frozen.length
  const position = done ? "" : `${index + 1} / ${frozen.length}`
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
    setIndex((i) => {
      const n = Math.min(i + 1, frozen.length)
      if (n !== i && frozen[i]) seenRef.current.push(frozen[i].id)
      return n
    })
  }, [frozen])

  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0))
  }, [])

  const loadMore = useCallback(
    (newQueue?: NoteRef[]) => {
      setFrozen(newQueue ? [...newQueue] : derived)
      setIndex(0)
    },
    [derived],
  )

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
    loadMore,
  }
}
