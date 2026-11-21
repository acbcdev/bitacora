import { useState } from "react"
import type { Skill } from "@/core/agent/skills"

// `/` solo al inicio del mensaje, hasta el caret y sin espacios: `/res`.
export function findSlash(text: string, caret: number) {
  const m = /^\/([a-z0-9-]*)$/.exec(text.slice(0, caret))
  return m ? m[1] : null
}

// Menú `/`: elegir un Skill solo escribe `/nombre ` en el composer; los argumentos van después y
// el envío es lo que lo dispara.
export function useSlash(
  draft: string,
  caret: number,
  skills: Skill[],
  fill: (text: string) => void,
) {
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const query = findSlash(draft, caret)
  const open = query !== null && dismissed !== draft
  const options = query === null ? [] : skills.filter((s) => s.name.includes(query))
  const cur = Math.min(active, Math.max(options.length - 1, 0))

  const choose = (s: Skill) => fill(`/${s.name} `)

  // true = la tecla era del menú.
  function onKeyDown(e: React.KeyboardEvent): boolean {
    if (!open) return false
    const n = options.length
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!n) return false
      setActive((cur + (e.key === "ArrowDown" ? 1 : n - 1)) % n)
    } else if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
      // Sin coincidencias, Enter envía como texto normal.
      if (!options[cur]) return false
      choose(options[cur])
    } else if (e.key === "Escape") setDismissed(draft)
    else return false
    e.preventDefault()
    return true
  }

  return { open, options, active: cur, setActive, choose, onKeyDown }
}

export function SlashMenu({ slash }: { slash: ReturnType<typeof useSlash> }) {
  const { options, active, setActive, choose } = slash
  return (
    <div
      role="listbox"
      aria-label="Skills"
      className="absolute right-3 bottom-full left-3 z-10 mb-1 flex max-h-80 flex-col overflow-hidden rounded-xl border bg-popover shadow-lg"
    >
      {options.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">Ningún skill coincide</p>
      ) : (
        <>
          <p className="shrink-0 px-3 pt-2 pb-1 text-xs text-muted-foreground">Skills</p>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {options.map((s, i) => (
              <div
                key={s.name}
                role="option"
                aria-selected={i === active}
                ref={(el) => {
                  if (el && i === active) el.scrollIntoView({ block: "nearest" })
                }}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                className="flex cursor-pointer items-baseline gap-3 rounded-lg px-3 py-1.5 aria-selected:bg-muted"
              >
                <span className="font-mono text-sm">/{s.name}</span>
                <span className="truncate text-xs text-muted-foreground">{s.description}</span>
              </div>
            ))}
          </div>
          <p className="shrink-0 border-t px-3 py-1.5 text-xs text-muted-foreground max-md:hidden">
            ↑ ↓ elegir · ⏎ usar · esc cerrar
          </p>
        </>
      )}
    </div>
  )
}
