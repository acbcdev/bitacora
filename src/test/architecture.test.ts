import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// Fitness function para ADR 0011: el seam `Store` es la única puerta a la DB.
// El cliente crudo de Supabase vive escondido detras de `core/store/`; ningun
// feature ni componente lo alcanza directo. Esta regla estaba en prosa (ADR +
// AGENTS.md) y nada la hacia cumplir — ahora el build se pone rojo si se cruza.

const SRC = join(__dirname, "..")

// Unicos lugares autorizados a tocar el cliente crudo.
const CLIENT_OWNER = "core/store/supabase-store.ts" // unico que llama getSupabase()
const CLIENT_FACTORY = "core/lib/supabase.ts" // unico que llama createClient()

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name)
    if (e.isDirectory()) return tsFiles(full)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : []
  })
}

describe("ADR 0011 — la DB solo se toca por el seam Store", () => {
  const files = tsFiles(SRC).map((f) => ({
    rel: f.slice(SRC.length + 1),
    text: readFileSync(f, "utf8"),
  }))

  it("solo supabase-store.ts llama getSupabase() (el cliente)", () => {
    const offenders = files
      .filter((f) => f.rel !== CLIENT_OWNER)
      // borra la linea de la DEFINICION antes de buscar llamadas, si no el propio
      // factory (`export function getSupabase()`) se auto-flaggea.
      .filter((f) => /getSupabase\s*\(/.test(f.text.replace(/.*function getSupabase.*/g, "")))
      .map((f) => f.rel)
    expect(offenders, `cruzan el seam hacia el cliente crudo:\n${offenders.join("\n")}`).toEqual([])
  })

  it("solo core/lib/supabase.ts llama createClient()", () => {
    const offenders = files
      .filter((f) => f.rel !== CLIENT_FACTORY && /createClient\s*[(<]/.test(f.text))
      .map((f) => f.rel)
    expect(offenders, `crean un cliente fuera del factory:\n${offenders.join("\n")}`).toEqual([])
  })
})
