import { expect, test } from "vitest"
import { courseJumps } from "@/core/components/sidebar"
import type { Course } from "@/core/types/database"

const list = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}` }) as Course)

test("1-8 son posición y 9 es el último", () => {
  const jumps = courseJumps(list(12))
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

test("con menos de 8 cursos el 9 sigue siendo el último", () => {
  expect(courseJumps(list(3)).map(([n, c]) => [n, c.id])).toEqual([
    [1, "c1"],
    [2, "c2"],
    [3, "c3"],
    [9, "c3"],
  ])
})

test("sin cursos no hay atajos", () => {
  expect(courseJumps([])).toEqual([])
})
