import { expect, test } from "vitest"
import { isMac } from "@/core/lib/utils"

const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"
const WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

test("isMac distingue mac de iOS y del resto", () => {
  expect(isMac(MAC)).toBe(true)
  expect(isMac(IPAD)).toBe(false)
  expect(isMac(WIN)).toBe(false)
})
