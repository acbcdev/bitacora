import { useState } from "react"
import { Plus } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/core/ui/button"
import { Input } from "@/core/ui/input"
import { Textarea } from "@/core/ui/textarea"
import { store } from "@/core/store"
import { skillNameError, type EffectiveSkill } from "@/core/agent/skills"
import { SKILLS_KEY, useSkills } from "@/agent/use-skills"

// Borrador de edición: `skill` = el que se edita (undefined = nuevo).
type Draft = { skill?: EffectiveSkill; name: string; description: string; prompt: string }

function SkillForm({
  draft,
  taken,
  onSave,
  onCancel,
}: {
  draft: Draft
  taken: string[]
  onSave: (d: Draft) => void
  onCancel: () => void
}) {
  const [d, setD] = useState(draft)
  const error = skillNameError(d.name, taken)
  const canSave = !error && d.prompt.trim() !== ""
  return (
    <form
      className="flex flex-col gap-2 rounded-lg bg-muted p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (canSave) onSave(d)
      }}
    >
      <Input
        aria-label="Nombre del skill"
        placeholder="nombre-del-skill"
        value={d.name}
        // El nombre de un built-in es la clave de su override: no se cambia.
        disabled={d.skill?.builtin}
        aria-invalid={d.name !== "" && !!error}
        onChange={(e) => setD({ ...d, name: e.target.value })}
        className="font-mono"
      />
      {d.name !== "" && error && <p className="text-xs text-destructive">{error}</p>}
      <Input
        aria-label="Descripción del skill"
        placeholder="Descripción corta"
        value={d.description}
        onChange={(e) => setD({ ...d, description: e.target.value })}
      />
      <Textarea
        aria-label="Prompt del skill"
        placeholder="Qué tiene que hacer el Agente"
        rows={4}
        value={d.prompt}
        onChange={(e) => setD({ ...d, prompt: e.target.value })}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={!canSave}>
          Guardar
        </Button>
      </div>
    </form>
  )
}

// CRUD de Skills en los ajustes de AI (ADR 0028). Editar un built-in guarda un override;
// "Restaurar" lo borra y vuelve el de fábrica.
export function SkillsSettings() {
  const skills = useSkills()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Draft | null>(null)

  async function run(op: Promise<void>) {
    try {
      await op
      await qc.invalidateQueries({ queryKey: SKILLS_KEY })
      setEditing(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const startEdit = (skill: EffectiveSkill) =>
    setEditing({ skill, name: skill.name, description: skill.description, prompt: skill.prompt })

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Skills del Agente</p>
          <p className="text-sm text-muted-foreground">
            Instrucciones que invocás con <code>/nombre</code> en el chat.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing({ name: "", description: "", prompt: "" })}
        >
          <Plus /> Nuevo
        </Button>
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {editing && !editing.skill && (
          <SkillForm
            draft={editing}
            taken={skills.map((s) => s.name)}
            onCancel={() => setEditing(null)}
            onSave={(d) =>
              void run(
                store.skills.save({
                  name: d.name,
                  description: d.description.trim(),
                  prompt: d.prompt.trim(),
                }),
              )
            }
          />
        )}
        {skills.map((s) =>
          editing?.skill?.name === s.name ? (
            <SkillForm
              key={s.name}
              draft={editing}
              taken={skills.filter((o) => o.name !== s.name).map((o) => o.name)}
              onCancel={() => setEditing(null)}
              onSave={(d) =>
                void run(
                  store.skills.save({
                    id: s.id,
                    name: d.name,
                    description: d.description.trim(),
                    prompt: d.prompt.trim(),
                  }),
                )
              }
            />
          ) : (
            <div key={s.name} className="flex items-center gap-3 rounded-lg px-3 py-2">
              <span className="font-mono text-sm">/{s.name}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {s.description}
              </span>
              <Button variant="ghost" size="sm" onClick={() => startEdit(s)}>
                Editar
              </Button>
              {s.builtin && s.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void run(store.skills.remove(s.id!))}
                >
                  Restaurar
                </Button>
              )}
              {!s.builtin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => void run(store.skills.remove(s.id!))}
                >
                  Borrar
                </Button>
              )}
            </div>
          ),
        )}
      </div>
    </section>
  )
}
