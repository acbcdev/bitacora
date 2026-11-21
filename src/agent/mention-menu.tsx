import { useMemo, useState } from "react"
import { BookOpen, FileText, Target } from "lucide-react"
import { useSnapshot } from "@/core/lib/snapshot"
import { cn } from "@/core/lib/utils"

export type MentionOption = { kind: "nota" | "notebook" | "habitos"; id: string; label: string }
type Tab = "todo" | MentionOption["kind"]
const TABS: { id: Tab; name: string }[] = [
  { id: "todo", name: "Todo" },
  { id: "nota", name: "Notas" },
  { id: "notebook", name: "Notebooks" },
  { id: "habitos", name: "Hábitos" },
]
const ICON = { nota: FileText, notebook: BookOpen, habitos: Target }
const ALL_HABITS_OPTION: MentionOption = { kind: "habitos", id: "*", label: "Todos los hábitos" }
const MAX = 50

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

// `@` tras inicio o espacio, hasta el caret. `start` = índice del `@`.
export function findMention(text: string, caret: number) {
  const m = /(^|\s)@(\S*)$/.exec(text.slice(0, caret))
  return m ? { query: m[2], start: caret - m[2].length - 1 } : null
}

// `@` en el composer: elegir una nota o notebook la saca del texto y la adjunta (mismo
// camino que el `+`). Los skills (`/`) están pendientes: `.scratch/agent-ui-v2/`.
export function useMention(
  draft: string,
  caret: number,
  strip: (start: number, end: number) => void,
  pick: (o: MentionOption) => void,
) {
  const [tab, setTab] = useState<Tab>("todo")
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState<number | null>(null)
  const m = findMention(draft, caret)
  const open = m !== null && dismissed !== m.start
  const { data } = useSnapshot((s) => [
    ...s.notes
      .filter((n) => n.kind === "note")
      .map((n): MentionOption => ({ kind: "nota", id: n.id, label: n.title })),
    ...s.notebooks.map((n): MentionOption => ({ kind: "notebook", id: n.id, label: n.name })),
    ...(s.habits.length ? [ALL_HABITS_OPTION] : []),
  ])
  const options = useMemo(() => {
    const q = norm(m?.query ?? "")
    return (data ?? [])
      .filter((o) => (tab === "todo" || o.kind === tab) && norm(o.label || "").includes(q))
      .slice(0, MAX)
  }, [data, tab, m?.query])
  const cur = Math.min(active, Math.max(options.length - 1, 0))

  function choose(o: MentionOption) {
    if (!m) return
    strip(m.start, m.start + 1 + m.query.length)
    pick(o)
  }

  // true = la tecla era del menú.
  function onKeyDown(e: React.KeyboardEvent): boolean {
    if (!open) return false
    const n = options.length
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!n) return false
      setActive((cur + (e.key === "ArrowDown" ? 1 : n - 1)) % n)
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const i = TABS.findIndex((t) => t.id === tab)
      setTab(TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id)
      setActive(0)
    } else if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
      if (!options[cur]) return false
      choose(options[cur])
    } else if (e.key === "Escape") setDismissed(m.start)
    else return false
    e.preventDefault()
    return true
  }

  return { open, tab, setTab, options, active: cur, setActive, choose, onKeyDown }
}

export function MentionMenu({ mention }: { mention: ReturnType<typeof useMention> }) {
  const { tab, setTab, options, active, setActive, choose } = mention
  return (
    <div
      role="listbox"
      aria-label="Contexto"
      className="absolute right-3 bottom-full left-3 z-10 mb-1 flex max-h-80 flex-col overflow-hidden rounded-xl border bg-popover shadow-lg"
    >
      <div className="flex shrink-0 gap-1 border-b p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setTab(t.id)
              setActive(0)
            }}
            className={cn(
              "rounded-pill px-3 py-1 text-xs transition-colors duration-150 ease-out",
              tab === t.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {options.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
        )}
        {options.map((o, i) => {
          const Icon = ICON[o.kind]
          return (
            <div
              key={`${o.kind}:${o.id}`}
              role="option"
              aria-selected={i === active}
              ref={(el) => {
                if (el && i === active) el.scrollIntoView({ block: "nearest" })
              }}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{o.label || "(sin título)"}</span>
            </div>
          )
        })}
      </div>
      <p className="shrink-0 border-t px-3 py-1.5 text-xs text-muted-foreground max-md:hidden">
        ← → categoría · ⏎ elegir · esc cerrar
      </p>
    </div>
  )
}
