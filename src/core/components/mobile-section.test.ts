import { describe, expect, it } from "vitest"
import { currentSection, switchLine } from "@/core/components/mobile-section"

const heads = [
  { section: "habitos" as const, top: 500 },
  { section: "notebooks" as const, top: 1200 },
]

describe("currentSection", () => {
  it("sin cabeceras cruzadas es Repaso", () => {
    expect(currentSection(heads, 499)).toBe("repaso")
    expect(currentSection([], 300)).toBe("repaso")
  })
  it("cambia cuando la cabecera cruza la línea, no cuando llega arriba", () => {
    expect(currentSection(heads, 500)).toBe("habitos")
  })
  it("toma la última cruzada", () => {
    expect(currentSection(heads, 1300)).toBe("notebooks")
  })
})

describe("switchLine", () => {
  it("queda a mitad del área visible, bajo la barra", () => {
    // barra 56, viewport 664 → 56 + 608/2
    expect(switchLine(56, 664)).toBe(360)
  })
})
