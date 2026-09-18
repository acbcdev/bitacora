import { Fragment, useMemo, useState } from "react"
import { Globe, Layers } from "lucide-react"
import { IconPicker } from "@/notebooks/icon-picker"
import { FieldPill, dotColor } from "@/notebooks/field-pill"
import { useNotebooks, useCreateNotebook, useUpdateNotebook } from "@/notebooks/notebooks.api"
import { Button } from "@/core/ui/button"
import { Drialog, DrialogContent, DrialogTitle } from "@/core/ui/drialog"
import { Input } from "@/core/ui/input"
import type { Notebook } from "@/core/types/database"

function useNotebookFieldSuggestions() {
  const { data: notebooks = [] } = useNotebooks()
  return useMemo(() => {
    const uniq = (field: "source" | "area") => [
      ...new Set(notebooks.map((c) => c[field]).filter((v): v is string => !!v)),
    ]
    return { sourceOptions: uniq("source"), areaOptions: uniq("area") }
  }, [notebooks])
}

export function NotebookForm({
  notebook,
  onClose,
}: {
  notebook: Notebook | null
  onClose: () => void
}) {
  const create = useCreateNotebook()
  const update = useUpdateNotebook()
  const { sourceOptions, areaOptions } = useNotebookFieldSuggestions()

  const [name, setName] = useState(notebook?.name ?? "")
  const [icon, setIcon] = useState(notebook?.icon ?? null)
  const [source, setSource] = useState(notebook?.source ?? "")
  const [area, setArea] = useState(notebook?.area ?? "")
  // Solo lectura: fechas y estado no se editan en el form (el estado se cambia desde la vista
  // del notebook). Se reenvían tal cual para no pisar started_at/finished_at/status al editar.
  const status = notebook?.status ?? "active"
  const startedAt = notebook?.started_at?.slice(0, 10) ?? ""
  const finishedAt = notebook?.finished_at?.slice(0, 10) ?? ""

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // 'sv' da fecha local como YYYY-MM-DD (toISOString usaría UTC y a partir de las 22:00
    // guardaría la fecha de ayer).
    const today = new Date().toLocaleDateString("sv")
    const finished = status === "done" && !finishedAt ? today : finishedAt
    const input = {
      name,
      icon,
      source: source || null,
      area: area || null,
      status,
      started_at: startedAt || null,
      finished_at: finished || null,
    }
    const done = { onSuccess: onClose }
    if (!notebook) create.mutate(input, done)
    else update.mutate({ ...input, id: notebook.id }, done)
  }

  return (
    <Drialog open onOpenChange={(open) => !open && onClose()}>
      <DrialogContent
        showCloseButton={false}
        className="gap-0 overflow-visible p-0 md:w-[480px] md:max-w-[480px] rounded-2xl"
      >
        <form onSubmit={submit}>
          {/* a11y title — visualmente es el placeholder grande */}
          <DrialogTitle className="sr-only">
            {notebook ? "Editar notebook" : "Nuevo notebook"}
          </DrialogTitle>

          <div className="flex flex-col gap-4 px-[22px] pt-[22px] pb-[18px]">
            <div className="flex items-center gap-3">
              <IconPicker
                icon={icon}
                onChange={setIcon}
                className="size-9 rounded-[10px] bg-secondary border-border hover:bg-accent shrink-0"
              />
              <label htmlFor="notebook-name" className="sr-only">
                Nombre
              </label>
              <Input
                id="notebook-name"
                autoFocus
                required
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del notebook"
                className="h-auto flex-1 border-0 bg-transparent px-0 py-1 text-[21px] font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/60 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
              />
            </div>

            <div className="flex gap-2 flex-nowrap">
              <FieldPill
                id="notebook-source"
                className="flex-1"
                value={source}
                onChange={setSource}
                options={sourceOptions}
                placeholder="Fuente"
                icon={<Globe />}
                showDot={!!source.trim() && !!area.trim()}
              />
              <FieldPill
                id="notebook-area"
                className="flex-1"
                value={area}
                onChange={setArea}
                options={areaOptions}
                placeholder="Área"
                icon={<Layers />}
                showDot={!!source.trim() && !!area.trim()}
              />
            </div>
          </div>

          {/* Acciones a la izquierda, resumen fuente/área a la derecha. */}
          <div className="flex items-center justify-between gap-2 border-t px-[18px] py-3.5">
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">{notebook ? "Guardar" : "Crear notebook"}</Button>
            </div>
            {(() => {
              // Vacío si no hay nada; separador solo entre valores. Cada valor trunca
              // individualmente (con min-w-0 en toda la cadena) para no desbordar el modal.
              const vals = [source.trim(), area.trim()].filter(Boolean)
              if (vals.length === 0) return null
              return (
                <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  {vals.map((v, i) => (
                    <Fragment key={v}>
                      {i > 0 && <span>·</span>}
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <span
                          aria-hidden
                          className="size-[7px] shrink-0 rounded-full"
                          style={{ background: dotColor(v) }}
                        />
                        <span className="min-w-0 truncate">{v}</span>
                      </span>
                    </Fragment>
                  ))}
                </span>
              )
            })()}
          </div>
        </form>
      </DrialogContent>
    </Drialog>
  )
}
