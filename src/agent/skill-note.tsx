import { useEffect, useRef, useState } from "react"
import { Ellipsis, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/core/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { Editor } from "@/core/components/editor"
import { docToMarkdown, markdownToDoc } from "@/core/lib/tiptap-markdown"
import { skillNameError, type EffectiveSkill } from "@/core/agent/skills"
import { isEdited } from "@/agent/skill-index"

export type SkillDraft = Pick<EffectiveSkill, "name" | "description" | "prompt">

// Click en una zona vacía = foco al prompt, con el cursor al final (como el body del notebook).
// Los controles conservan su propio click.
export function focusPrompt(e: React.MouseEvent<HTMLElement>) {
  if ((e.target as HTMLElement).closest("input,button,[role=menuitem],.ProseMirror")) return
  const pm = e.currentTarget.querySelector<HTMLElement>(".ProseMirror")
  if (!pm) return
  pm.focus()
  const range = document.createRange()
  range.selectNodeContents(pm)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

// Un built-in intacto no tiene nada que restaurar; un nuevo sin guardar se descarta con "Borrar".
function SkillMenu({ skill, onRemove }: { skill: EffectiveSkill; onRemove: () => void }) {
  if (skill.builtin && !isEdited(skill)) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Acciones del skill">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant={skill.builtin ? undefined : "destructive"} onSelect={onRemove}>
          {skill.builtin ? <RotateCcw /> : <Trash2 />}
          {skill.builtin ? "Restaurar de fábrica" : "Borrar skill"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const kind = (s: EffectiveSkill) => (!s.builtin ? "Propio" : isEdited(s) ? "Editado" : "De fábrica")

// Cuerpo de nota para un Skill (estructura del notebook): eyebrow → título grande (el nombre) →
// caption mono (descripción) → cuerpo Tiptap (el prompt, guardado como markdown). Autosave como el
// Borrador de nota (ADR 0021): debounce de 800 ms y flush al desmontar. Solo se guarda un estado
// válido (nombre sin error y prompt no vacío): un skill nuevo no toca el Store hasta entonces.
export function SkillNote({
  skill,
  taken,
  onSave,
  onRemove,
  leading,
}: {
  skill: EffectiveSkill
  taken: string[]
  onSave: (d: SkillDraft) => void
  onRemove: () => void
  // Lo que va a la izquierda de la cabecera (el botón de salir del modo grande).
  leading?: React.ReactNode
}) {
  const saved: SkillDraft = {
    name: skill.name,
    description: skill.description,
    prompt: skill.prompt,
  }
  const [d, setD] = useState(saved)
  // El Editor es no controlado (`content` solo se lee al montar): el padre remonta esta nota
  // (key) cuando el prompt cambia por fuera, p. ej. al restaurar.
  const [doc] = useState(() => markdownToDoc(skill.prompt))
  const error = skillNameError(d.name, taken)
  const noPrompt = d.prompt.trim() === ""
  const valid = !error && !noPrompt
  // El Store guarda description y prompt recortados: se compara contra eso, si no un espacio al
  // final dejaría la nota "sucia" para siempre.
  const dirty =
    d.name !== saved.name ||
    d.description.trim() !== saved.description ||
    d.prompt.trim() !== saved.prompt

  const latest = useRef({ d, valid, dirty })
  latest.current = { d, valid, dirty }
  // Tras Restaurar/Borrar el borrador local ya no vale: ni el debounce ni el flush lo reescriben.
  const discarded = useRef(false)

  useEffect(() => {
    if (!dirty || !valid) return
    const t = setTimeout(() => {
      if (!discarded.current) onSave(latest.current.d)
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d])
  // Salir de la nota (otro skill, minimizar, cerrar Ajustes) no pierde lo tipeado.
  useEffect(
    () => () => {
      const l = latest.current
      if (!discarded.current && l.dirty && l.valid) onSave(l.d)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const status = !dirty
    ? skill.builtin && !isEdited(skill)
      ? "de fábrica"
      : "guardado"
    : error
      ? error
      : noPrompt
        ? "falta el prompt, no se guarda"
        : "guardando…"

  return (
    <div className="flex min-h-0 flex-1 flex-col" onClick={focusPrompt}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between">
          {leading ?? <span className="eyebrow">Skill · {kind(skill)}</span>}
          <SkillMenu
            skill={skill}
            onRemove={() => {
              discarded.current = true
              onRemove()
            }}
          />
        </div>
        <div className="mt-3 flex items-baseline text-5xl font-semibold tracking-tight">
          <span aria-hidden className="text-muted-foreground">
            /
          </span>
          <input
            aria-label="Nombre del skill"
            autoFocus={!skill.builtin && skill.name === ""}
            autoComplete="off"
            // El nombre de un built-in es la clave de su override: no se cambia.
            disabled={skill.builtin}
            placeholder="nombre-del-skill"
            value={d.name}
            onChange={(e) => setD({ ...d, name: e.target.value })}
            className="min-w-0 flex-1 bg-transparent leading-tight outline-none placeholder:text-muted-foreground/60 disabled:cursor-default"
          />
        </div>
        <input
          aria-label="Descripción del skill"
          autoComplete="off"
          placeholder="Descripción corta"
          value={d.description}
          onChange={(e) => setD({ ...d, description: e.target.value })}
          className="mt-2 w-full bg-transparent font-mono text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <div className="relative mt-8 min-h-48 flex-1">
          {noPrompt && (
            <p className="pointer-events-none absolute top-0 text-muted-foreground/60">
              Qué tiene que hacer el Agente
            </p>
          )}
          <Editor
            content={doc}
            onChange={(next) => setD((prev) => ({ ...prev, prompt: docToMarkdown(next) }))}
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-center pt-3 font-mono text-xs text-muted-foreground">
        <span className={dirty && error ? "text-destructive" : undefined}>
          autosave activado · {status}
        </span>
      </div>
    </div>
  )
}
