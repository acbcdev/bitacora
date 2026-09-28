import { describe, expect, it } from "vitest"
import { scaledHeight } from "./image-resize"

describe("scaledHeight", () => {
  it("mantiene el aspect ratio al escalar", () => {
    // 900x600 → width 450 debe dar height 300 (3:2)
    expect(scaledHeight(450, 900, 600)).toBe(300)
  })

  it("escala a ancho mayor", () => {
    expect(scaledHeight(1800, 900, 600)).toBe(1200)
  })

  it("sin dims devuelve null", () => {
    expect(scaledHeight(450, null, 600)).toBeNull()
    expect(scaledHeight(450, 900, null)).toBeNull()
    expect(scaledHeight(450, null, null)).toBeNull()
  })
})
