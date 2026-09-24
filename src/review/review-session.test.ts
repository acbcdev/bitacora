import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { EMPTY_READ_STATS } from "@/core/store/derive"
import type { ReadStats } from "@/core/store/derive"
import type { NoteRef } from "@/core/store/types"
import { useReviewSession } from "./review-session"

// El hook es la única implementación de la sesión: se testea con renderHook + mocks
// de su IO (cola derivada, stats, mutation de repaso) — nada de Store ni Supabase.
const h = vi.hoisted(() => ({
  queue: { current: [] as NoteRef[] },
  // Sin EMPTY_READ_STATS acá: vi.hoisted corre antes de los imports del módulo.
  stats: { current: { today: 0, streak: 0, byNote: new Map(), byDay: new Map() } as ReadStats },
  markMutate: vi.fn(),
}))

vi.mock("@/review/review.api", () => ({
  useReviewQueue: () => ({ data: h.queue.current }),
  useMarkRead: () => ({ mutate: h.markMutate }),
}))
vi.mock("@/core/lib/snapshot", () => ({
  useSnapshot: () => ({ data: h.stats.current }),
}))

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

function session() {
  return renderHook(() => useReviewSession())
}

beforeEach(() => {
  h.markMutate.mockClear()
})

describe("useReviewSession", () => {
  test("next/prev clampean 0..length", () => {
    h.queue.current = [ref("n1"), ref("n2"), ref("n3")]
    const { result } = session()
    expect(result.current.index).toBe(0)
    expect(result.current.position).toBe("1 / 3")
    act(() => result.current.prev())
    expect(result.current.index).toBe(0)
    act(() => result.current.next())
    act(() => result.current.next())
    act(() => result.current.next())
    expect(result.current.index).toBe(3)
    expect(result.current.done).toBe(true)
    expect(result.current.item).toBeNull()
    expect(result.current.position).toBe("")
    act(() => result.current.next())
    expect(result.current.index).toBe(3) // no pasa de length
    act(() => result.current.prev())
    expect(result.current.index).toBe(2)
    expect(result.current.done).toBe(false)
    expect(result.current.item?.id).toBe("n3")
  })

  test("cola vacía arranca done", () => {
    h.queue.current = []
    const { result } = session()
    expect(result.current.done).toBe(true)
    expect(result.current.item).toBeNull()
    expect(result.current.position).toBe("")
    expect(result.current.length).toBe(0)
    act(() => result.current.next())
    act(() => result.current.prev())
    expect(result.current.index).toBe(0)
  })

  test("cambiar index resetea revealed", () => {
    h.queue.current = [ref("n1"), ref("n2")]
    const { result } = session()
    expect(result.current.revealed).toBe(false)
    act(() => result.current.reveal())
    expect(result.current.revealed).toBe(true)
    act(() => result.current.next())
    expect(result.current.revealed).toBe(false)
    act(() => result.current.reveal())
    expect(result.current.revealed).toBe(true)
    act(() => result.current.prev())
    expect(result.current.revealed).toBe(false)
  })

  test("loadMore descongela y resetea index/revealed", () => {
    h.queue.current = [ref("n1"), ref("n2")]
    const { result } = session()
    act(() => result.current.next())
    act(() => result.current.reveal())
    expect(result.current.index).toBe(1)
    expect(result.current.revealed).toBe(true)
    act(() => result.current.loadMore([ref("n10"), ref("n11"), ref("n12"), ref("n13")]))
    expect(result.current.length).toBe(4)
    expect(result.current.index).toBe(0)
    expect(result.current.item?.id).toBe("n10")
    expect(result.current.revealed).toBe(false)
    expect(result.current.position).toBe("1 / 4")
    expect(result.current.done).toBe(false)
  })

  test("mark idempotente no duplica el repaso", () => {
    h.queue.current = [ref("n1"), ref("n2")]
    const { result } = session()
    expect(result.current.marked).toBe(false)
    act(() => result.current.mark())
    expect(h.markMutate).toHaveBeenCalledTimes(1)
    expect(h.markMutate).toHaveBeenCalledWith({ noteId: "n1", grade: undefined })
    expect(result.current.marked).toBe(true)
    act(() => result.current.mark())
    expect(h.markMutate).toHaveBeenCalledTimes(1) // segundo no dispara
    act(() => result.current.mark("correcto"))
    expect(h.markMutate).toHaveBeenCalledTimes(1)
    // mover y volver no re-dispara si es el mismo id
    act(() => result.current.next())
    expect(result.current.marked).toBe(false)
    act(() => result.current.prev())
    expect(result.current.marked).toBe(true) // sigue marcado
    act(() => result.current.mark())
    expect(h.markMutate).toHaveBeenCalledTimes(1)
  })

  test("mark con grade lo forwardéa", () => {
    h.queue.current = [ref("f1", { kind: "flashcard" })]
    const { result } = session()
    act(() => result.current.mark("correcto"))
    expect(h.markMutate).toHaveBeenCalledWith({ noteId: "f1", grade: "correcto" })
    expect(result.current.marked).toBe(true)
  })

  test("mark sin item es no-op", () => {
    h.queue.current = []
    const { result } = session()
    act(() => result.current.mark())
    expect(h.markMutate).not.toHaveBeenCalled()
    h.queue.current = [ref("n1")]
    const { result: r2 } = session()
    act(() => r2.current.next()) // done
    act(() => r2.current.mark())
    expect(h.markMutate).not.toHaveBeenCalled()
  })

  test("reads viene de stats.byNote", () => {
    h.stats.current = statsWith({ n1: 5, n2: 0 })
    h.queue.current = [ref("n1"), ref("n2")]
    const { result } = session()
    expect(result.current.reads).toBe(5)
    act(() => result.current.next())
    expect(result.current.reads).toBe(0) // count 0 entra como 0
    h.queue.current = [ref("n99")]
    const { result: r2 } = session()
    expect(r2.current.reads).toBe(0)
  })

  test("reveal no-op cuando done", () => {
    h.queue.current = [ref("n1")]
    const { result } = session()
    act(() => result.current.next())
    expect(result.current.done).toBe(true)
    act(() => result.current.reveal())
    // en done no hay item, no debería prender revealed — pero tampoco explota
    expect(result.current.revealed).toBe(false)
  })

  test("position refleja index+1 / length", () => {
    h.queue.current = [ref("a"), ref("b"), ref("c")]
    const { result } = session()
    expect(result.current.position).toBe("1 / 3")
    act(() => result.current.next())
    expect(result.current.position).toBe("2 / 3")
    act(() => result.current.next())
    expect(result.current.position).toBe("3 / 3")
    act(() => result.current.next())
    expect(result.current.position).toBe("")
  })
})
