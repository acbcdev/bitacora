import { useEffect, useRef, useState } from "react"
import { ChevronRight, Minimize2, Plus } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Badge } from "@/core/ui/badge"
import { Button } from "@/core/ui/button"
import { store } from "@/core/store"
import { effectiveSkills, type EffectiveSkill } from "@/core/agent/skills"
import { SKILLS_KEY, useSkills } from "@/agent/use-skills"
import { SkillIndex, isEdited } from "@/agent/skill-index"
import { SkillNote, focusPrompt, type SkillDraft } from "@/agent/skill-note"
import { Group } from "@/settings/ui"

// Skill abierto en el modo grande. `key` es estable mientras la nota vive (renombrar un propio no
// la remonta); `v` sube solo cuando el prompt cambia por fuera (Restaurar) y fuerza el remonte.
// `skill` es el último estado confirmado por el Store.
type Open = { key: string; v: number; skill: EffectiveSkill }

const NEW: EffectiveSkill = { name: "", description: "", prompt: "", builtin: false }

// CRUD de Skills en los ajustes de AI (ADR 0028). La lista vive en Ajustes; abrir un skill lo
// muestra "en grande" sobre todo el diálogo, con la estructura del notebook (índice + nota con
// autosave). Editar un built-in guarda un override; "Restaurar" borra la fila.
export function SkillsSettings() {
  const skills = useSkills()
  const qc = useQueryClient()
  const [open, setOpen] = useState<Open | null>(null)
  // Nombre que tiene cada nota abierta en el Store tras su último save ("" = todavía no existe).
  const names = useRef(new Map<string, string>())
  // Cola: un built-in sin override no tiene `id` y `save` no lo devuelve, así que cada job resuelve
  // la fila contra el Store al correr. Sin cola, dos autosaves seguidos crearían el mismo nombre dos
  // veces ("Ya existe un skill con ese nombre").
  const chain = useRef(Promise.resolve())
  const enqueue = (job: () => Promise<void>) => {
    chain.current = chain.current.then(job).catch((e) => {
      // Supabase tira PostgrestError (objeto plano, no Error): sin `.message` el toast diría
      // "[object Object]" y taparía, por ejemplo, un 404 por migración sin aplicar.
      toast.error(
        e instanceof Error || (e && typeof e === "object" && "message" in e)
          ? String((e as Error).message)
          : String(e),
      )
    })
  }

  const rowOf = async (name: string) =>
    name ? (await store.skills.list()).find((r) => r.name === name) : undefined
  // Refresca la lista y devuelve el skill efectivo ya confirmado (undefined si no existe).
  const fresh = async (name: string) => {
    await qc.invalidateQueries({ queryKey: SKILLS_KEY })
    return effectiveSkills(await store.skills.list()).find((s) => s.name === name)
  }

  const show = (key: string, skill: EffectiveSkill) => {
    names.current.set(key, skill.name)
    setOpen({ key, v: 0, skill })
  }

  const save = (key: string, d: SkillDraft) =>
    enqueue(async () => {
      const row = await rowOf(names.current.get(key) ?? "")
      await store.skills.save({
        id: row?.id,
        name: d.name,
        description: d.description.trim(),
        prompt: d.prompt.trim(),
      })
      names.current.set(key, d.name)
      const skill = await fresh(d.name)
      // Si el usuario ya abrió otro skill, este resultado no le toca.
      setOpen((o) => (o?.key === key && skill ? { ...o, skill } : o))
    })

  // Propio → se borra. Built-in → se borra el override y vuelve el de fábrica. Un nuevo que nunca
  // se guardó no tiene fila: solo se cierra.
  const remove = (key: string) =>
    enqueue(async () => {
      const name = names.current.get(key) ?? ""
      const row = await rowOf(name)
      if (row) await store.skills.remove(row.id)
      const skill = await fresh(name)
      if (!skill) return setOpen((o) => (o?.key === key ? null : o))
      setOpen((o) => (o?.key === key ? { ...o, skill, v: o.v + 1 } : o))
    })

  // Esc en el modo grande sale del modo grande, no cierra Ajustes. Radix escucha Esc en `document`
  // (captura); un listener en `window` (captura) corre antes y corta la propagación. Si hay un
  // menú o popover abierto (el ···, el menú slash, el bubble) Esc es de ellos: no se toca.
  const isOpen = open !== null
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (document.querySelector('[data-slot="popover-content"],[role="menu"],[role="listbox"]'))
        return
      e.stopPropagation()
      setOpen(null)
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [isOpen])

  const own = skills.filter((s) => !s.builtin)
  const row = (s: EffectiveSkill) => (
    <button
      key={s.name}
      type="button"
      onClick={() => show(s.name, s)}
      className="group flex w-full items-center gap-3 py-3.5 text-left"
    >
      <span className="font-mono text-sm font-medium">/{s.name}</span>
      {isEdited(s) && <Badge>Editado</Badge>}
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{s.description}</span>
      <ChevronRight className="text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
    </button>
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => show(`new-${Date.now()}`, NEW)}>
          <Plus /> Nuevo
        </Button>
      </div>
      <Group title="De fábrica">{skills.filter((s) => s.builtin).map(row)}</Group>
      {own.length > 0 && <Group title="Propios">{own.map(row)}</Group>}
      {open && (
        // `absolute inset-0` se ancla al DrialogContent de Ajustes (fixed): cubre todo el diálogo.
        // Mismo radio y superficie que él, si no asoman las esquinas y el ring.
        <div
          onClick={focusPrompt}
          className="absolute inset-0 z-20 flex overflow-hidden rounded-xl bg-popover animate-in fade-in-0 duration-150 motion-reduce:animate-none"
        >
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 left-3 z-10"
            onClick={() => setOpen(null)}
          >
            <Minimize2 /> Ajustes
          </Button>
          <div className="flex min-w-0 flex-1 flex-col px-10 pt-8 pb-4">
            <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col">
              <SkillNote
                key={`${open.key}.${open.v}`}
                skill={open.skill}
                taken={skills.filter((o) => o.name !== open.skill.name).map((o) => o.name)}
                onSave={(d) => save(open.key, d)}
                onRemove={() => remove(open.key)}
                // El botón de volver va anclado a la esquina del overlay; acá solo se anula el eyebrow.
                leading={<span />}
              />
            </div>
          </div>
          <SkillIndex
            className="w-72 shrink-0 border-l p-3"
            // El nuevo todavía no está en la lista: se muestra aparte hasta que se guarda.
            skills={
              skills.some((s) => s.name === open.skill.name) ? skills : [...skills, open.skill]
            }
            active={open.skill.name}
            onSelect={(s) => show(s.name, s)}
            onNew={() => show(`new-${Date.now()}`, NEW)}
          />
        </div>
      )}
    </div>
  )
}
