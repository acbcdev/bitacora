import { describe, expect, it } from "vitest"
import { toCsv } from "./csv"

describe("toCsv", () => {
  it("entrecomilla texto, dobla comillas y deja null vacío (= NULL en copy csv)", () => {
    const csv = toCsv([
      { id: "a", title: 'dijo "hola", y', content: "linea1\nlinea2", finished_at: null },
    ])
    expect(csv).toBe('id,title,content,finished_at\n"a","dijo ""hola"", y","linea1\nlinea2",\n')
  })

  it("string vacío se distingue de null", () => {
    expect(toCsv([{ a: "", b: null }])).toBe('a,b\n"",\n')
  })

  it("números y booleanos van sin comillas", () => {
    expect(toCsv([{ position: 0, imported: true }])).toBe("position,imported\n0,true\n")
  })
})
