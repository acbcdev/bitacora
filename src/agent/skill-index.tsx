import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Input } from "@/core/ui/input"
import { cn } from "@/core/lib/utils"
import type { EffectiveSkill } from "@/core/agent/skills"

// Mismas filas que el índice del notebook (hover a media intensidad, el activo es el único
// sólido). Header + búsqueda + lista que scrollea + pill de alta fijo al pie.
const ROW =
  "flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-left text-sm text-fg-secondary hover:bg-muted/50 data-[active=true]:bg-muted data-[active=true]:text-foreground"

// "Editado" = un built-in con override en el Store (tiene fila, o sea `id`).
export const isEdited = (s: EffectiveSkill) => s.builtin && !!s.id

export function SkillIndex({
  skills,
  active,
  onSelect,
  onNew,
  className,
}: {
  skills: EffectiveSkill[]
  active: string
  onSelect: (s: EffectiveSkill) => void
  onNew: () => void
  className?: string
}) {
  const [q, setQ] = useState("")
  const needle = q.trim().toLowerCase()
  const shown = needle
    ? skills.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(needle))
    : skills
  const own = skills.filter((s) => !s.builtin).length
  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div>
        <p className="text-sm font-semibold">Skills</p>
        <p className="text-xs text-muted-foreground">
          {skills.length - own} de fábrica · {own} {own === 1 ? "propio" : "propios"}
        </p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar skill"
          placeholder="Buscar skill…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-pill pl-8"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {shown.map((s) => (
          <button
            key={s.name}
            type="button"
            data-active={s.name === active}
            onClick={() => onSelect(s)}
            className={ROW}
          >
            <span className="min-w-0 flex-1 truncate">/{s.name || "nuevo-skill"}</span>
            {isEdited(s) && <span className="text-2xs text-muted-foreground">editado</span>}
          </button>
        ))}
        {shown.length === 0 && (
          <p className="px-2.5 py-2 text-sm text-muted-foreground">Sin resultados</p>
        )}
      </div>
      <Button className="w-full" onClick={onNew}>
        <Plus /> Nuevo skill
      </Button>
    </div>
  )
}
