import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  Check,
  MoreHorizontal,
  PanelRight,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { NotebookForm } from "@/notebooks/notebook-form"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { STATUS, STATUS_DOT } from "@/notebooks/notebook-status"
import { NoteActions } from "@/notes/note-actions"
import { NotebookSkeleton } from "@/core/components/skeletons"
import { Badge } from "@/core/ui/badge"
import { Button } from "@/core/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { Kbd } from "@/core/ui/kbd"
import { Sidebar, SidebarProvider } from "@/core/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { useQueryClient } from "@tanstack/react-query"
import {
  toggleNotebookDone,
  useNotebooks,
  useDeleteNotebook,
  useUpdateNotebook,
} from "@/notebooks/notebooks.api"
import { togglePinnedNotebook, usePinnedNotebookIds } from "@/notebooks/pinned-notebooks"
import { NoteEditor } from "@/notes/note"
import { useCreateNote, useNotes, useUpdateNote } from "@/notes/notes.api"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import { daysSince } from "@/core/lib/day"
import { useSnapshot } from "@/core/lib/snapshot"
import { EMPTY_READ_STATS, lastEditedNote, readStats } from "@/core/store/derive"
import { alt, cn, mod } from "@/core/lib/utils"
import { store } from "@/core/store"

// Variant E ("UI Bitácora", .scratch/sidebar-redesign): el título usa todo el ancho de la fila;
// frescura y menú viven en una pastilla absoluta al pie derecho que los tapa (bg-inherit: siempre
// matchea el bg de la fila, transparente/muted/activo) — el título gana ancho cuando no hay rótulo.
// `shrink-0`: la lista es un flex-col que scrollea — sin esto, con muchas notas el browser achica
// las filas para que entren en vez de scrollear. Hover a media intensidad: el activo es el único sólido.
const NOTE_ROW =
  "group/note flex h-8 shrink-0 items-center rounded-lg px-2.5 text-[13px] text-fg-secondary hover:bg-muted/50 data-[active=true]:bg-muted data-[active=true]:text-foreground"

// Frescura por nota: el rótulo y su color. ≤7d verde (recién repasada), ≥30d amarillo (se está
// enfriando), null = nunca repasada → celda vacía (sin ruido). El repaso vive en Home/Repaso:
// el sidebar sólo diagnostica.
function freshness(last: string | null | undefined, now = new Date()) {
  const d = daysSince(last, now)
  if (d === null) return null
  return {
    label: `hace ${d}d`,
    cls: d <= 7 ? "text-signal" : d >= 30 ? "text-warning" : "text-muted-foreground",
    dot: d <= 7 ? "bg-signal" : d >= 30 ? "bg-warning" : "bg-muted-foreground",
  }
}

// Pantalla Notebook: la nota a la izquierda (NoteEditor embedded, notes/06: mismo componente que
// /note/:id standalone, con focus mode/paste-smart/etc) y el índice del notebook a la derecha.
// La URL manda: /notebook/:id/:noteId siempre apunta a una nota real (se auto-corrige si no).
// J / K se mueven entre notas sin tocar el mouse. Focus mode esconde este aside (y el
// Sidebar global, en App) igual que en la nota standalone.
export function Notebook({ focus, onToggleFocus }: { focus: boolean; onToggleFocus: () => void }) {
  const { id, noteId } = useParams()
  const navigate = useNavigate()
  const { data: notebooks = [] } = useNotebooks()
  const { data: notes = [], isLoading } = useNotes(id!)
  const { data: stats = EMPTY_READ_STATS } = useSnapshot((s) => readStats(s))
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const qc = useQueryClient()
  const updateNotebook = useUpdateNotebook()
  const isMobile = useIsMobile()
  const deleteNotebook = useDeleteNotebook()
  const pinned = usePinnedNotebookIds().includes(id!)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [q, setQ] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const [confirmingNote, setConfirmingNote] = useState<string | null>(null)
  // Nota recién creada desde este pane: su título monta con foco (ver `ghostType`, Nueva nota).
  const [created, setCreated] = useState<string | null>(null)
  const ghost = useRef("")
  // Índice = segundo Sidebar (derecha), ⌘⌥B lo colapsa (el provider con `alt`). Solo desktop —
  // en mobile va apilado arriba de la nota (collapsible="none") y no estorba.
  const [indexOpen, setIndexOpen] = useState(() => localStorage.getItem("bita-nb-index") !== "0")
  useEffect(() => {
    localStorage.setItem("bita-nb-index", indexOpen ? "1" : "0")
  }, [indexOpen])

  const notebook = notebooks.find((c) => c.id === id)
  // Selección inicial = la última editada (spec .scratch/editor-flow, issue 02). El índice NO se
  // reordena — la lista queda por `position`; sólo cambia la nota en la que caés al entrar.
  // Con noteId válido, nada cambia.
  const selected = notes.find((n) => n.id === noteId) ?? lastEditedNote(notes)

  // Filtro de búsqueda del índice: por título, en cliente (el snapshot ya trae los títulos).
  const visible = q
    ? notes.filter((n) => (n.title || "(sin título)").toLowerCase().includes(q.toLowerCase()))
    : notes
  useSafeHotkeys(
    // "slash", no "/": la lib matchea por e.code (ver comentario en notebooks.tsx).
    "slash",
    () => searchRef.current?.focus(),
    { preventDefault: true },
  )

  function select(target: { id: string }) {
    navigate(`/notebook/${id}/${target.id}`)
    // Stacked en mobile la nota queda debajo del índice: sin esto, tocar una nota no se ve.
    if (isMobile) document.getElementById("note-pane")?.scrollIntoView({ behavior: "smooth" })
  }

  // Auto-corrige la URL: sin noteId, o uno que no matchea ninguna nota del notebook -> la 1ra.
  useEffect(() => {
    if (!isLoading && selected && selected.id !== noteId) {
      navigate(`/notebook/${id}/${selected.id}`, { replace: true })
    }
  }, [id, noteId, selected, isLoading, navigate])

  // Nav del índice entre notas en alt+J/K (ADR 0024): ⌘K es la palette y ⌘←/→ es inicio/fin de
  // línea en el editor. Forzado con enableOnContentEditable para andar con el foco en el editor.
  // Se mueven sobre las notas VISIBLES (el filtro de búsqueda): saltar a una fila escondida
  // se sentiría como un bug. Nueva nota no tiene tecla: ⌘N es del browser (ADR 0024).
  function step(dir: "back" | "forward") {
    const i = visible.findIndex((n) => n.id === selected?.id)
    const target =
      visible[dir === "forward" ? Math.min(i + 1, visible.length - 1) : Math.max(i - 1, 0)]
    if (target) select(target)
  }
  useSafeHotkeys(
    "alt+j",
    () => step("back"),
    { enableOnContentEditable: true, preventDefault: true },
    [visible, selected],
  )
  useSafeHotkeys(
    "alt+k",
    () => step("forward"),
    { enableOnContentEditable: true, preventDefault: true },
    [visible, selected],
  )

  function create() {
    createNote.mutate(id!, {
      onSuccess: (note) => {
        setCreated(note.id)
        navigate(`/notebook/${id}/${note.id}`)
      },
    })
  }

  // Notebook vacío = editor fantasma: el 1er keystroke crea la nota y el tipeo sigue en el textarea
  // mientras vuela el insert. Al volver, lo tipeado se siembra en ["note", id] (el editor monta con
  // eso) y se persiste — si no, el server quedaría con el título del instante del create.
  function ghostType(value: string) {
    const first = !ghost.current
    ghost.current = value
    if (!first) return
    createNote.mutate(id!, {
      onSuccess: (note) => {
        const title = ghost.current
        qc.setQueryData(["note", note.id], { ...note, title })
        updateNote.mutate({ id: note.id, title, content: note.content })
        ghost.current = ""
        setCreated(note.id)
        navigate(`/notebook/${id}/${note.id}`)
      },
    })
  }

  const read = notes.filter((n) => (stats?.byNote.get(n.id)?.count ?? 0) > 0).length
  const pct = notes.length ? Math.round((read / notes.length) * 100) : 0

  // Loading ANTES que "no encontrado": notebooks y notas salen del mismo snapshot, así que mientras
  // carga `notebook` es undefined y sin este orden flasheaba el "no existe".
  if (isLoading) return <NotebookSkeleton />
  if (!notebook)
    return (
      <div className="mx-auto max-w-read px-4 pt-9 sm:px-8 md:max-w-note md:px-20">
        <div className="mb-8 flex h-8 items-center">
          <Link to="/" className="mono-dim hover:text-foreground">
            ← notebooks
          </Link>
        </div>
        <h1 className="text-4xl font-semibold tracking-tighter text-muted-foreground">
          Este notebook no existe.
        </h1>
      </div>
    )

  const noMatch = q !== "" && visible.length === 0

  return (
    // Mobile: una columna — índice del notebook arriba, nota abajo (a 393px la nota partida en dos
    // columnas queda de ~120px y el título rompe letra por letra). Scrollea `main`, no cada panel.
    <SidebarProvider
      alt
      open={indexOpen}
      onOpenChange={setIndexOpen}
      className="fade-in flex-col md:h-full md:min-h-0 md:flex-row"
      style={{ "--sidebar-width": "clamp(14rem, 19vw, 17rem)" } as React.CSSProperties}
    >
      {/* Espejo del SidebarTrigger de App: misma esquina libre, del lado derecho. */}
      {!indexOpen && !focus && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4 z-10 max-md:hidden"
              onClick={() => setIndexOpen(true)}
              aria-label="Mostrar notas"
            >
              <PanelRight />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mostrar notas · {mod(alt("B"))}</TooltipContent>
        </Tooltip>
      )}
      <div id="note-pane" className="min-w-0 flex-1 md:overflow-y-auto">
        {selected ? (
          <NoteEditor
            key={selected.id}
            id={selected.id}
            focus={focus}
            onToggleFocus={onToggleFocus}
            embedded
            autoFocusTitle={selected.id === created}
          />
        ) : (
          // Sin pantalla de vacío: es la primera nota sin escribir. Tipear la crea.
          <div className="mx-auto max-w-read px-4 pt-9 sm:px-8 md:max-w-note md:px-20">
            <div className="mb-8 flex h-8 items-center">
              <span className="mono-dim">nota nueva · todavía no existe</span>
            </div>
            <textarea
              autoFocus
              rows={1}
              aria-label="Título de la primera nota"
              placeholder="Título"
              onChange={(e) => ghostType(e.target.value)}
              className="field-sizing-content w-full resize-none bg-transparent text-4xl font-semibold tracking-tighter outline-none placeholder:text-muted-foreground"
            />
            <p className="mt-6 text-base text-muted-foreground">
              Escribí para crear la primera nota de este notebook.
            </p>
          </div>
        )}
      </div>

      {/* Desktop: solo la lista de notas scrollea — cabecera y acciones quedan fijas. Mobile: alto
          auto, scrollea `main`, así que el overflow va con `md:`. Variant E ("UI Bitácora",
          .scratch/sidebar-redesign): header compacto + chips, búsqueda con /, filas con frescura
          y footer con Nueva nota. */}
      {!focus && (
        <Sidebar
          side="right"
          collapsible={isMobile ? "none" : "offcanvas"}
          className="max-md:order-first max-md:h-auto max-md:w-full max-md:border-b"
        >
          <div className="shrink-0 px-4 pt-4 pb-2">
            <div className="flex items-start gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-card">
                <NotebookIcon icon={notebook.icon} className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="eyebrow truncate">
                  {[notebook.source, notebook.area].filter(Boolean).join(" · ")}
                </div>
                <h1 className="line-clamp-2 text-sm leading-snug font-semibold tracking-tight">
                  {notebook.name}
                </h1>
              </div>
              {/* Lo frecuente a la vista (fijar acá, cerrar/reabrir en el chip de estado); el ⋯ queda
                  para lo raro (editar) y lo destructivo (borrar). */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-pressed={pinned}
                    aria-label={pinned ? "Desfijar" : "Fijar"}
                    className={cn(
                      "shrink-0",
                      pinned ? "bg-muted text-foreground" : "text-muted-foreground",
                    )}
                    onClick={() => togglePinnedNotebook(notebook.id)}
                  >
                    <Pin className={cn("size-3.5", pinned && "fill-current")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {pinned ? "Desfijar del sidebar" : "Fijar en el sidebar"}
                </TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="-mr-1.5 shrink-0 text-muted-foreground"
                        aria-label="Acciones del notebook"
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Acciones</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => setEditing(true)}>
                    <Pencil />
                    Editar notebook
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                    <Trash2 />
                    Borrar notebook
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {/* El chip de estado ES el toggle cerrar/reabrir: el fin es cuando apretás, no un date
                  picker. Reabrir limpia `finished_at` (toggleNotebookDone) — si no, un notebook activo
                  quedaría con fecha de fin. Hover cambia el dot por la acción (✓/↺) en un slot fijo de
                  12px, así el chip no cambia de ancho. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    asChild
                    className={cn(
                      "cursor-pointer normal-case hover:bg-track",
                      STATUS[notebook.status].cls,
                    )}
                  >
                    <button onClick={() => updateNotebook.mutate(toggleNotebookDone(notebook))}>
                      <span className="grid size-3 place-items-center">
                        <i
                          aria-hidden
                          className={cn(
                            "size-1.5 rounded-full group-hover/badge:hidden",
                            STATUS_DOT[notebook.status],
                          )}
                        />
                        {notebook.status === "done" ? (
                          <RotateCcw className="hidden size-3 group-hover/badge:block" />
                        ) : (
                          <Check className="hidden size-3 group-hover/badge:block" />
                        )}
                      </span>
                      {STATUS[notebook.status].label}
                    </button>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {notebook.status === "done" ? "Reabrir notebook" : "Marcar finalizado"}
                </TooltipContent>
              </Tooltip>
              <Badge className="normal-case">{notes.length} notas</Badge>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-track">
                <div className="h-full bg-fg-secondary" style={{ width: `${pct}%` }} />
              </div>
              <span className="mono-dim text-2xs">{pct}% repasado</span>
            </div>
          </div>

          <div className="shrink-0 px-4 pb-1">
            {/* Mismo campo que "Buscar notebook…" (notebook-toolbar): ring sutil en vez del borde de
                InputGroup, y el `/` se va al enfocar o con texto. */}
            <label className="group flex h-8 items-center gap-2 rounded-full bg-card px-3 shadow-card ring-1 ring-border focus-within:ring-border-strong">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    if (q) setQ("")
                    searchRef.current?.blur()
                  }
                }}
                placeholder="Buscar nota…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {!q && <Kbd className="group-focus-within:hidden">/</Kbd>}
            </label>
          </div>

          <div className="flex flex-col gap-0.5 px-2 py-1.5 md:min-h-0 md:flex-1 md:overflow-y-auto md:pb-2">
            {visible.map((n) => {
              const f = freshness(stats?.byNote.get(n.id)?.last)
              return (
                <div key={n.id} data-active={n.id === selected?.id} className={NOTE_ROW}>
                  <button
                    onClick={() => select(n)}
                    className="flex min-w-0 flex-1 items-center rounded-lg text-left"
                  >
                    <span className="truncate">{n.title || "(sin título)"}</span>
                  </button>
                  {/* Frescura como dot (el rótulo "hace 94d" en cada fila era ruido y le robaba ancho
                      al título); el detalle va en el tooltip del dot, con hit area de 20px. El ⋯
                      aparece a la izquierda en hover: el dot queda fijo en el borde. En el flujo (no absoluto): el título se encoge y su
                      `truncate` pone el `…` antes en vez de quedar tapado. */}
                  <div className="flex shrink-0 items-center">
                    <span className="hidden group-focus-within/note:grid group-has-[[aria-expanded=true]]/note:grid group-hover/note:grid">
                      <NoteActions
                        note={n}
                        // El índice lista refs sin content: se pide la nota entera recién al
                        // copiar/exportar — igual que el editor, que es el único que la necesita.
                        content={() => store.note(n.id).then((full) => full.content)}
                        hideNotebook
                        confirming={confirmingNote === n.id}
                        onConfirmingChange={(open) => setConfirmingNote(open ? n.id : null)}
                        onDeleted={() => navigate(`/notebook/${id}`)}
                      />
                    </span>
                    {f && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            aria-label={`Repasada ${f.label}`}
                            className="-mr-1.5 grid size-5 place-items-center"
                          >
                            <i className={cn("size-1.5 rounded-full", f.dot)} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Repasada <span className={cn("font-mono", f.cls)}>{f.label}</span>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              )
            })}
            {/* Búsqueda sin match: sin esto la lista quedaba en blanco y parecía rota. */}
            {noMatch && (
              <div className="flex h-8 items-center gap-2 px-2.5 text-sm text-muted-foreground">
                <span className="truncate">Ninguna nota con “{q}”</span>
                <Kbd className="ml-auto">Esc</Kbd>
              </div>
            )}
          </div>

          <div className="mt-auto shrink-0 border-t p-3 md:mt-0">
            <Button className="w-full" onClick={create}>
              <Plus />
              Nueva nota
            </Button>
          </div>

          {/* Mismo dialog que la lista de notebooks: `NotebookForm` se monta abierto y se desmonta al
              cerrar, así el form arranca siempre con los valores frescos del notebook. */}
          {editing && <NotebookForm notebook={notebook} onClose={() => setEditing(false)} />}

          {/* Borrar deja la pantalla sin notebook que mostrar, así que vuelve a la lista. */}
          <ConfirmDelete
            open={confirming}
            onOpenChange={setConfirming}
            what={notebook.name}
            onConfirm={() => deleteNotebook.mutate(notebook.id, { onSuccess: () => navigate("/") })}
          />
        </Sidebar>
      )}
    </SidebarProvider>
  )
}
