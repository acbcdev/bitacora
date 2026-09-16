import { useMemo, useState } from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { Globe, Layers } from "lucide-react"
import { IconPicker } from "@/notebooks/icon-picker"
import { useNotebooks, useCreateNotebook, useUpdateNotebook } from "@/notebooks/notebooks.api"
import { Button } from "@/core/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/core/ui/combobox"
import { Drialog, DrialogContent, DrialogTitle } from "@/core/ui/drialog"
import { Field, FieldGroup, FieldLabel } from "@/core/ui/field"
import { Input } from "@/core/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/core/ui/input-group"
import { NativeSelect } from "@/core/ui/native-select"
import { cn } from "@/core/lib/utils"
import type { Notebook, NotebookStatus } from "@/core/types/database"

function useNotebookFieldSuggestions() {
  const { data: notebooks = [] } = useNotebooks()
  return useMemo(() => {
    const uniq = (field: "source" | "area") => [
      ...new Set(notebooks.map((c) => c[field]).filter((v): v is string => !!v)),
    ]
    return { sourceOptions: uniq("source"), areaOptions: uniq("area") }
  }, [notebooks])
}

const DOT_COLORS = [
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fbbf24",
  "#34d399",
  "#38bdf8",
  "#fb923c",
  "#ef4444",
  "#7ed321",
  "#f43f5e",
  "#9ca3af",
  "#14b8a6",
]
function dotColor(value: string) {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return DOT_COLORS[h % DOT_COLORS.length]
}

function PillCombobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  icon,
  showDot,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
  icon: React.ReactNode
  showDot: boolean
}) {
  const trimmed = value.trim()
  const dc = showDot && trimmed ? dotColor(trimmed) : null

  return (
    <Combobox<string>
      items={options}
      inputValue={value}
      // Ignorar el reset ('input-clear') que Base UI hace al cerrar el popup: sincroniza el
      // input al valor seleccionado y borra lo tipeado. Sin esto, escribir una fuente/área
      // nueva y cambiar de campo la pierde — no se puede crear un valor libre.
      onInputValueChange={(v, details) => {
        if (details.reason === "input-clear") return
        onChange(v)
      }}
      onValueChange={(v) => onChange(v ?? "")}
    >
      <InputGroup
        className={cn(
          "h-[34px] w-auto min-w-0 max-w-[180px] shrink-0 rounded-full border bg-transparent transition-colors hover:border-border-strong hover:bg-accent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/10",
          trimmed && "border-border-strong bg-secondary hover:bg-secondary",
        )}
      >
        <InputGroupAddon
          align="inline-start"
          className="pl-2.5 pr-1 text-muted-foreground [&_svg]:size-3.5"
        >
          {dc ? (
            <span
              aria-hidden
              className="pointer-events-none size-[7px] shrink-0 rounded-full"
              style={{ background: dc }}
            />
          ) : (
            icon
          )}
        </InputGroupAddon>
        <ComboboxPrimitive.Input
          id={id}
          placeholder={placeholder}
          aria-label={placeholder}
          render={
            <InputGroupInput className="px-0 text-[13.5px] font-medium placeholder:font-normal" />
          }
        />
        <InputGroupAddon align="inline-end" className="pr-1 pl-0">
          <ComboboxTrigger className="size-6 rounded-full data-[pressed]:bg-transparent [&_svg]:size-3.5 opacity-60 hover:opacity-100" />
        </InputGroupAddon>
      </InputGroup>
      <ComboboxContent
        align="center"
        collisionAvoidance={{ side: "none" }}
        className="min-w-[220px] rounded-xl p-1"
      >
        <ComboboxEmpty>Sin resultados</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item} className="gap-2">
              <span
                aria-hidden
                className="pointer-events-none size-[7px] shrink-0 rounded-full"
                style={{ background: dotColor(item) }}
              />
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
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
  const [status, setStatus] = useState<NotebookStatus>(notebook?.status ?? "active")
  const [startedAt, setStartedAt] = useState(() => notebook?.started_at?.slice(0, 10) ?? "")
  const [finishedAt, setFinishedAt] = useState(() => notebook?.finished_at?.slice(0, 10) ?? "")

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

            <div className="flex gap-2 flex-nowrap justify-center">
              <div>
                <label htmlFor="notebook-source" className="sr-only">
                  Fuente
                </label>
                <PillCombobox
                  id="notebook-source"
                  value={source}
                  onChange={setSource}
                  options={sourceOptions}
                  placeholder="Fuente"
                  icon={<Globe />}
                  showDot={!!source.trim() && !!area.trim()}
                />
              </div>
              <div>
                <label htmlFor="notebook-area" className="sr-only">
                  Área
                </label>
                <PillCombobox
                  id="notebook-area"
                  value={area}
                  onChange={setArea}
                  options={areaOptions}
                  placeholder="Área"
                  icon={<Layers />}
                  showDot={!!source.trim() && !!area.trim()}
                />
              </div>
            </div>
          </div>

          <div className="border-t px-[22px] py-4 flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="notebook-status" className="eyebrow">
                Estado
              </FieldLabel>
              <NativeSelect
                id="notebook-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as NotebookStatus)}
                className="w-full [&>select]:h-10 [&>select]:text-base"
              >
                <option value="active">activo</option>
                <option value="paused">pausado</option>
                <option value="done">hecho</option>
              </NativeSelect>
            </Field>
            <FieldGroup className="flex-row">
              <Field>
                <FieldLabel htmlFor="notebook-started" className="eyebrow">
                  Inicio
                </FieldLabel>
                <Input
                  id="notebook-started"
                  type="date"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  className="h-10"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="notebook-finished" className="eyebrow">
                  Fin
                </FieldLabel>
                <Input
                  id="notebook-finished"
                  type="date"
                  value={finishedAt}
                  onChange={(e) => setFinishedAt(e.target.value)}
                  className="h-10"
                />
              </Field>
            </FieldGroup>
          </div>

          <div className="flex items-center justify-between gap-2 border-t px-[18px] py-3.5">
            {(() => {
              const s = source.trim()
              const a = area.trim()
              if (!s && !a) {
                return (
                  <span className="font-mono text-xs text-muted-foreground/50 truncate min-w-0">
                    Fuente · Área
                  </span>
                )
              }
              if (s && a) {
                return (
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground truncate min-w-0">
                    <span className="inline-flex items-center gap-1">
                      <span
                        aria-hidden
                        className="size-[7px] shrink-0 rounded-full"
                        style={{ background: dotColor(s) }}
                      />
                      {s}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <span
                        aria-hidden
                        className="size-[7px] shrink-0 rounded-full"
                        style={{ background: dotColor(a) }}
                      />
                      {a}
                    </span>
                  </span>
                )
              }
              return (
                <span className="font-mono text-xs text-muted-foreground truncate min-w-0">
                  {`${s || "—"} · ${a || "—"}`}
                </span>
              )
            })()}
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">{notebook ? "Guardar" : "Crear notebook"}</Button>
            </div>
          </div>
        </form>
      </DrialogContent>
    </Drialog>
  )
}
