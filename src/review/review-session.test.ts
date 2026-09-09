import { describe, expect, test, vi } from "vitest"
import { EMPTY_READ_STATS } from "@/core/store/derive"
import type { ReadStats } from "@/core/store/derive"
import type { NoteRef } from "@/core/store/types"
import { createReviewSession } from "./review-session"

function ref(id: string, over: Partial<NoteRef> = {}): NoteRef {
  return {
    id,
    title: id,
    notebook_id: "c1",
    position: 0,
    kind: "note",
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  } as NoteRef
}

function statsWith(counts: Record<string, number>): ReadStats {
  const byNote = new Map<string, { count: number; last: string | null }>()
  for (const [id, count] of Object.entries(counts)) {
    byNote.set(id, { count, last: "2026-01-01T00:00:00Z" })
  }
  return { ...EMPTY_READ_STATS, byNote, byDay: new Map(), today: 0, streak: 0 }
}

describe("createReviewSession — pura sin React ni Store", () => {
  test("next/prev clampean 0..length", () => {
    const s = createReviewSession({
      queue: [ref("n1"), ref("n2"), ref("n3")],
      stats: EMPTY_READ_STATS,
      markRead: vi.fn(),
    })
    expect(s.index).toBe(0)
    expect(s.position).toBe("1 / 3")
    s.prev()
    expect(s.index).toBe(0)
    s.next()
    expect(s.index).toBe(1)
    s.next()
    expect(s.index).toBe(2)
    s.next()
    expect(s.index).toBe(3)
    expect(s.done).toBe(true)
    expect(s.item).toBeNull()
    expect(s.position).toBe("")
    s.next()
    expect(s.index).toBe(3) // no pasa de length
    s.prev()
    expect(s.index).toBe(2)
    expect(s.done).toBe(false)
    expect(s.item?.id).toBe("n3")
  })

  test("cola vacía arranca done", () => {
    const s = createReviewSession({ queue: [], stats: EMPTY_READ_STATS, markRead: vi.fn() })
    expect(s.done).toBe(true)
    expect(s.item).toBeNull()
    expect(s.position).toBe("")
    expect(s.length).toBe(0)
    s.next()
    expect(s.index).toBe(0)
    s.prev()
    expect(s.index).toBe(0)
  })

  test("cambiar index resetea revealed", () => {
    const s = createReviewSession({
      queue: [ref("n1"), ref("n2")],
      stats: EMPTY_READ_STATS,
      markRead: vi.fn(),
    })
    expect(s.revealed).toBe(false)
    s.reveal()
    expect(s.revealed).toBe(true)
    s.next()
    expect(s.revealed).toBe(false)
    s.reveal()
    expect(s.revealed).toBe(true)
    s.prev()
    expect(s.revealed).toBe(false)
  })

  test("loadMore descongela y resetea index/revealed", () => {
    const s = createReviewSession({
      queue: [ref("n1"), ref("n2")],
      stats: EMPTY_READ_STATS,
      markRead: vi.fn(),
    })
    s.next()
    s.reveal()
    expect(s.index).toBe(1)
    expect(s.revealed).toBe(true)
    s.loadMore([ref("n10"), ref("n11"), ref("n12"), ref("n13")])
    expect(s.length).toBe(4)
    expect(s.index).toBe(0)
    expect(s.item?.id).toBe("n10")
    expect(s.revealed).toBe(false)
    expect(s.position).toBe("1 / 4")
    expect(s.done).toBe(false)
  })

  test("mark idempotente no duplica store.save", () => {
    const spy = vi.fn()
    const s = createReviewSession({
      queue: [ref("n1"), ref("n2")],
      stats: EMPTY_READ_STATS,
      markRead: spy,
    })
    expect(s.marked).toBe(false)
    s.mark()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith("n1", undefined)
    expect(s.marked).toBe(true)
    s.mark()
    expect(spy).toHaveBeenCalledTimes(1) // segundo no dispara
    s.mark("correcto")
    expect(spy).toHaveBeenCalledTimes(1)
    // mover y volver no re-dispara si es el mismo id
    s.next()
    expect(s.marked).toBe(false)
    s.prev()
    expect(s.marked).toBe(true) // sigue marcado
    s.mark()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  test("mark con grade lo forwardéa", () => {
    const spy = vi.fn()
    const s = createReviewSession({
      queue: [ref("f1", { kind: "flashcard" })],
      stats: EMPTY_READ_STATS,
      markRead: spy,
    })
    s.mark("correcto")
    expect(spy).toHaveBeenCalledWith("f1", "correcto")
    expect(s.marked).toBe(true)
  })

  test("mark sin item es no-op", () => {
    const spy = vi.fn()
    const s = createReviewSession({ queue: [], stats: EMPTY_READ_STATS, markRead: spy })
    s.mark()
    expect(spy).not.toHaveBeenCalled()
    const s2 = createReviewSession({ queue: [ref("n1")], stats: EMPTY_READ_STATS, markRead: spy })
    s2.next() // done
    s2.mark()
    expect(spy).not.toHaveBeenCalled()
  })

  test("reads viene de stats.byNote", () => {
    const stats = statsWith({ n1: 5, n2: 0 })
    const s = createReviewSession({ queue: [ref("n1"), ref("n2")], stats, markRead: vi.fn() })
    expect(s.reads).toBe(5)
    s.next()
    expect(s.reads).toBe(0) // existe con count 0 tratado como 0? en nuestro helper 0 entra
    // nota sin entrada
    const s2 = createReviewSession({ queue: [ref("n99")], stats, markRead: vi.fn() })
    expect(s2.reads).toBe(0)
  })

  test("revealed y done: reveal no-op cuando done", () => {
    const s = createReviewSession({
      queue: [ref("n1")],
      stats: EMPTY_READ_STATS,
      markRead: vi.fn(),
    })
    s.next()
    expect(s.done).toBe(true)
    s.reveal()
    // en done no hay item, no debería prender revealed — lo dejamos false
    // pero si se llamó reveal en done, no debería explotar
    expect(s.revealed).toBe(false)
  })

  test("position refleja index+1 / length", () => {
    const s = createReviewSession({
      queue: [ref("a"), ref("b"), ref("c")],
      stats: EMPTY_READ_STATS,
      markRead: vi.fn(),
    })
    expect(s.position).toBe("1 / 3")
    s.next()
    expect(s.position).toBe("2 / 3")
    s.next()
    expect(s.position).toBe("3 / 3")
    s.next()
    expect(s.position).toBe("")
  })
})
