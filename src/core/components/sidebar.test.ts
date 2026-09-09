import { expect, test } from "vitest"
import { notebookJumps } from "@/core/components/sidebar"
import type { Notebook } from "@/core/types/database"

const list = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}` }) as Notebook)

test("1-8 son posición y 9 es el último", () => {
  const jumps = notebookJumps(list(12))
  expect(jumps.map(([n, c]) => [n, c.id])).toEqual([
    [1, "c1"],
    [2, "c2"],
    [3, "c3"],
    [4, "c4"],
    [5, "c5"],
    [6, "c6"],
    [7, "c7"],
    [8, "c8"],
    [9, "c12"],
  ])
})

test("con menos de 8 notebooks el 9 sigue siendo el último", () => {
  expect(notebookJumps(list(3)).map(([n, c]) => [n, c.id])).toEqual([
    [1, "c1"],
    [2, "c2"],
    [3, "c3"],
    [9, "c3"],
  ])
})

test("sin notebooks no hay atajos", () => {
  expect(notebookJumps([])).toEqual([])
})
