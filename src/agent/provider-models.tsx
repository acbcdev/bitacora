import { useRef, useState } from "react"
import { Check, Eye, Minus, Plus, Wrench } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Input } from "@/core/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { cn } from "@/core/lib/utils"
import type { ModelEntry } from "@/core/agent/provider"

// Desde acá el filtro "N activos" aparece; con menos modelos sobra.
const FILTER_FROM = 8

type BoxState = "on" | "off" | "mixed"

function Box({ state }: { state: BoxState }) {
  const Icon = state === "mixed" ? Minus : Check
  return (
    <span
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-sm border text-background transition-[background-color,border-color] duration-150",
        state === "off" ? "border-border-strong" : "border-foreground bg-foreground",
      )}
    >
      <Icon
        className={cn("size-3 transition-opacity duration-150", state === "off" && "opacity-0")}
        strokeWidth={3}
      />
    </span>
  )
}

// Dos celdas fijas de 24px: alinean con los toggles de arriba. Solo se pinta lo que el proveedor
// reportó como cierto; `undefined` es "no se sabe", no "no tiene".
function Caps({ caps }: { caps?: ModelEntry["caps"] }) {
  return (
    <span className="flex shrink-0 text-muted-foreground">
      <span
        className="grid size-6 place-items-center"
        title={caps?.tools ? "Herramientas" : undefined}
      >
        {caps?.tools && <Wrench className="size-3.5" />}
      </span>
      <span className="grid size-6 place-items-center" title={caps?.vision ? "Visión" : undefined}>
        {caps?.vision && <Eye className="size-3.5" />}
      </span>
    </span>
  )
}

function CapToggle({
  on,
  label,
  onClick,
  children,
}: {
  on: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={on ? "secondary" : "outline"}
          aria-pressed={on}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// Lista única de modelos. El buscador también da de alta: sin coincidencias, Enter agrega el id
// tipeado; con coincidencias, la fila "Agregar … a mano" se clickea (Enter solo no crea ids a
// medias mientras buscás). Los filtros de capacidad solo existen si algún modelo las reporta.
export function ProviderModels({
  models,
  onChange,
}: {
  models: ModelEntry[]
  onChange: (models: ModelEntry[]) => void
}) {
  const [q, setQ] = useState("")
  const [onlyActive, setOnlyActive] = useState(false)
  const [tools, setTools] = useState(false)
  const [vision, setVision] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)

  const needle = q.trim().toLowerCase()
  const shown = models.filter(
    (m) =>
      m.id.toLowerCase().includes(needle) &&
      (!onlyActive || m.visible) &&
      (!tools || m.caps?.tools) &&
      (!vision || m.caps?.vision),
  )
  const shownOn = shown.filter((m) => m.visible).length
  const head: BoxState = shownOn === 0 ? "off" : shownOn === shown.length ? "on" : "mixed"
  const createRow = needle !== "" && !models.some((m) => m.id === q.trim())
  const hasCaps = models.some((m) => m.caps?.tools || m.caps?.vision)
  const canFilter = models.length > FILTER_FROM
  const filtering = onlyActive || tools || vision

  const setMany = (ids: Set<string>, visible: boolean) =>
    onChange(models.map((m) => (ids.has(m.id) ? { ...m, visible } : m)))
  const toggle = (id: string) =>
    onChange(models.map((m) => (m.id === id ? { ...m, visible: !m.visible } : m)))
  const create = () => {
    const id = q.trim()
    onChange(
      models.some((m) => m.id === id)
        ? models.map((m) => (m.id === id ? { ...m, visible: true } : m))
        : [{ id, visible: true }, ...models],
    )
    setQ("")
  }

  // ↑/↓ recorren las filas; ↑ desde la primera vuelve al buscador.
  const nav = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    const rows = [...(list.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])]
    const i = rows.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    e.preventDefault()
    if (i === 0 && e.key === "ArrowUp") return search.current?.focus()
    rows[Math.min(Math.max(i + (e.key === "ArrowDown" ? 1 : -1), 0), rows.length - 1)]?.focus()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        <Input
          ref={search}
          aria-label="Buscar o agregar modelo"
          placeholder={
            models.length
              ? `Buscar entre ${models.length} o agregar uno…`
              : "Agregar un id de modelo a mano…"
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (createRow && shown.length === 0) create()
            } else if (e.key === "ArrowDown") {
              e.preventDefault()
              list.current?.querySelector<HTMLElement>("[data-row]")?.focus()
            }
          }}
        />
        {hasCaps && (
          <>
            <CapToggle on={tools} label="Solo con herramientas" onClick={() => setTools((v) => !v)}>
              <Wrench />
            </CapToggle>
            <CapToggle on={vision} label="Solo con visión" onClick={() => setVision((v) => !v)}>
              <Eye />
            </CapToggle>
          </>
        )}
      </div>

      {models.length > 0 && (
        <div className="flex items-center gap-3 px-2 text-xs text-muted-foreground">
          <label
            className={cn(
              "flex items-center",
              shown.length ? "cursor-pointer" : "pointer-events-none opacity-40",
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              aria-label="Seleccionar los modelos que se ven"
              checked={head === "on"}
              onChange={() => setMany(new Set(shown.map((m) => m.id)), head !== "on")}
            />
            <Box state={head} />
          </label>
          <span>
            {shown.length} {shown.length === 1 ? "modelo" : "modelos"} ·{" "}
            {canFilter ? (
              <button
                type="button"
                aria-pressed={onlyActive}
                onClick={() => setOnlyActive((v) => !v)}
                className={cn(
                  "cursor-pointer rounded-sm underline-offset-4 transition-colors hover:text-foreground",
                  onlyActive ? "text-foreground underline" : "hover:underline",
                )}
              >
                {shownOn} {shownOn === 1 ? "activo" : "activos"}
              </button>
            ) : (
              `${shownOn} ${shownOn === 1 ? "activo" : "activos"}`
            )}
          </span>
          <span className="flex-1" />
          {filtering && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => (setOnlyActive(false), setTools(false), setVision(false))}
            >
              Limpiar
            </Button>
          )}
          <span className="w-12" aria-hidden />
        </div>
      )}

      {/* El scrollbar vive en el margen derecho, no encima de las celdas de capacidades. */}
      <div className="-mr-3 max-h-72 overflow-y-auto pr-3 [scrollbar-gutter:stable]">
        <div ref={list} onKeyDown={nav} className="flex flex-col">
          {createRow && (
            <button
              type="button"
              data-row
              className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors duration-150 outline-none hover:bg-foreground/6 focus-visible:bg-foreground/6"
              onClick={create}
            >
              <Plus className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                Agregar <span className="font-mono">{q.trim()}</span> a mano
              </span>
              {shown.length === 0 && <kbd className="mono-dim">↵</kbd>}
            </button>
          )}
          {shown.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-foreground/4 has-focus-visible:bg-foreground/6"
            >
              <input
                data-row
                type="checkbox"
                className="sr-only"
                checked={m.visible}
                onChange={() => toggle(m.id)}
              />
              <Box state={m.visible ? "on" : "off"} />
              <span
                className={cn(
                  "min-w-0 flex-1 font-mono text-sm break-all",
                  !m.visible && "text-muted-foreground",
                )}
              >
                {m.id}
              </span>
              <Caps caps={m.caps} />
            </label>
          ))}
          {shown.length === 0 && !createRow && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {models.length
                ? "Ningún modelo coincide con los filtros."
                : "Probá la conexión para traer los modelos, o escribí un id y Enter."}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
