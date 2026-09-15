import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import {
  ArrowLeft,
  Check,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { NotebookForm } from "@/notebooks/notebook-form"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { NoteActions } from "@/notes/note-actions"
import { NoteEditor } from "@/notes/note"
import { NoteSkeleton } from "@/core/components/skeletons"
import { Badge } from "@/core/ui/badge"
import { Button } from "@/core/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/core/ui/input-group"
import { Kbd } from "@/core/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip"
import { useNotebooks, useDeleteNotebook, useUpdateNotebook } from "@/notebooks/notebooks.api"
import { togglePinnedNotebook, usePinnedNotebookIds } from "@/notebooks/pinned-notebooks"
import { useGenerateFlashcards } from "@/flashcards/flashcards.api"
import { useCreateNote, useNotes } from "@/notes/notes.api"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
import { useSafeHotkeys } from "@/core/lib/hooks/use-safe-hotkeys"
import { daysSince } from "@/core/lib/day"
import { useSnapshot } from "@/core/lib/snapshot"
import { EMPTY_READ_STATS, readStats } from "@/core/store/derive"
import { cn } from "@/core/lib/utils"
import { store } from "@/core/store"
import type { NotebookStatus } from "@/core/types/database"

// Variant E ("UI Bitácora", .scratch/sidebar-redesign): la celda derecha de cada fila tiene ancho
// y alto fijos — frescura y menú comparten la misma celda y se intercambian sin reflow, el título
// (1fr) nunca cambia de ancho.
const NOTE_ROW =
  "group/note relative grid h-8 grid-cols-[20px_1fr_56px] items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-fg-secondary hover:bg-muted data-[active=true]:bg-muted data-[active=true]:text-foreground"

// Frescura por nota: el rótulo y su color. ≤7d verde (recién repasada), ≥30d amarillo (se está
// enfriando), null = nunca repasada → celda vacía (sin ruido). El repaso vive en Home/Repaso:
// el sidebar sólo diagnostica.
function freshness(last: string | null | undefined, now = new Date()) {
  const d = daysSince(last, now)
  if (d === null) return null
  return {
    label: `hace ${d}d`,
    cls: d <= 7 ? "text-brand-fg" : d >= 30 ? "text-warning" : "text-muted-foreground",
  }
}

const STATUS: Record<NotebookStatus, string> = {
  active: "activo",
  paused: "pausado",
  done: "hecho",
}

// Pantalla Notebook: la nota a la izquierda (NoteEditor embedded, notes/06: mismo componente que
// /note/:id standalone, con focus mode/paste-smart/etc) y el índice del notebook a la derecha.
// La URL manda: /notebook/:id/:noteId siempre apunta a una nota real (se auto-corrige si no).
// J / K se mueven entre notas sin tocar el mouse. Focus mode esconde este aside (y el
// Sidebar global, en App) igual que en la nota standalone.
export function Notebook({ focus, setFocus }: { focus: boolean; setFocus: (v: boolean) => void }) {
  const { id, noteId } = useParams()
  const navigate = useNavigate()
  const { data: notebooks = [] } = useNotebooks()
  const { data: notes = [], isLoading } = useNotes(id!)
  const { data: stats = EMPTY_READ_STATS } = useSnapshot((s) => readStats(s))
  const createNote = useCreateNote()
  const updateNotebook = useUpdateNotebook()
  const generateFlashcards = useGenerateFlashcards(id!)
  const isMobile = useIsMobile()
  const deleteNotebook = useDeleteNotebook()
  const pinned = usePinnedNotebookIds().includes(id!)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [q, setQ] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const [confirmingNote, setConfirmingNote] = useState<string | null>(null)

  const notebook = notebooks.find((c) => c.id === id)
  const selected = notes.find((n) => n.id === noteId) ?? notes[0]

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

  // J/K y flechas entre notas del notebook. J/left = atrás, K/right = adelante. Además de la versión
  // bare (default de la lib: se desactiva sola con el foco en el editor embebido), se agrega el
  // alias mod+ forzado para cuando el foco SÍ está adentro del editor — misma acción, dos formas
  // de dispararla según dónde esté el foco.
  // Se mueven sobre las notas VISIBLES (el filtro de búsqueda): saltar a una fila escondida
  // se sentiría como un bug.
  function step(dir: "back" | "forward") {
    const i = visible.findIndex((n) => n.id === selected?.id)
    const target =
      visible[dir === "forward" ? Math.min(i + 1, visible.length - 1) : Math.max(i - 1, 0)]
    if (target) select(target)
  }
  useHotkeys("j,left", () => step("back"), { preventDefault: true }, [visible, selected])
  useHotkeys("k,right", () => step("forward"), { preventDefault: true }, [visible, selected])
  useHotkeys(
    "mod+j,mod+left",
    () => step("back"),
    { enableOnContentEditable: true, preventDefault: true },
    [visible, selected],
  )
  useHotkeys(
    "mod+k,mod+right",
    () => step("forward"),
    { enableOnContentEditable: true, preventDefault: true },
    [visible, selected],
  )
  useHotkeys(
    "n",
    () => createNote.mutate(id!, { onSuccess: (note) => navigate(`/notebook/${id}/${note.id}`) }),
    { preventDefault: true },
    [id, createNote],
  )

  const read = notes.filter((n) => (stats?.byNote.get(n.id)?.count ?? 0) > 0).length
  const pct = notes.length ? Math.round((read / notes.length) * 100) : 0

  if (!notebook) return <p className="p-8 text-muted-foreground">Notebook no encontrado.</p>

  return (
    // Mobile: una columna — índice del notebook arriba, nota abajo (a 393px la nota partida en dos
    // columnas queda de ~120px y el título rompe letra por letra). Scrollea `main`, no cada panel.
    <div className="fade-in flex flex-col md:h-full md:flex-row">
      <div id="note-pane" className="min-w-0 flex-1 md:overflow-y-auto">
        {isLoading ? (
          <NoteSkeleton />
        ) : selected ? (
          <NoteEditor
            key={selected.id}
            id={selected.id}
            focus={focus}
            setFocus={setFocus}
            embedded
          />
        ) : (
          <div className="mx-auto max-w-read px-4 pt-9 sm:px-8">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="mb-6"
                  onClick={() => navigate("/notebooks")}
                  aria-label="Volver"
                >
                  <ArrowLeft className="size-3.75" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Volver</TooltipContent>
            </Tooltip>
            <Empty className="px-0">
              <EmptyHeader>
                <EmptyTitle>Este notebook todavía no tiene notas.</EmptyTitle>
                <EmptyDescription>Creá la primera.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>

      {/* Desktop: solo la lista de notas scrollea — cabecera y acciones quedan fijas. Mobile: alto
          auto, scrollea `main`, así que el overflow va con `md:`. Variant E ("UI Bitácora",
          .scratch/sidebar-redesign): header compacto + chips, búsqueda con /, filas con frescura
          y footer con Nueva nota. */}
      {!focus && (
        <aside className="flex shrink-0 flex-col border-b max-md:order-first md:w-68 md:min-h-0 md:overflow-hidden md:border-b-0 md:border-l">
          <div className="shrink-0 px-4 pt-4 pb-2">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-card">
                <NotebookIcon icon={notebook.icon} className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="eyebrow truncate">
                  {[notebook.source, notebook.area].filter(Boolean).join(" · ")}
                </div>
                <h1 className="truncate text-[15px] font-semibold tracking-tight">
                  {notebook.name}
                </h1>
              </div>
              {/* Generar flashcards y cerrar el notebook son de una vez por notebook: acá, no compitiendo
                  con "Nueva nota" al pie. Además las flashcards no se ven en esta lista (kind
                  'flashcard', `useNotes` filtra 'note') — el resultado vive en /review. */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="-mr-1.5 shrink-0"
                        aria-label="Acciones del notebook"
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Acciones</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => togglePinnedNotebook(notebook.id)}>
                    {pinned ? <PinOff /> : <Pin />}
                    {pinned ? "Desfijar" : "Fijar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEditing(true)}>
                    <Pencil />
                    Editar notebook
                  </DropdownMenuItem>
                  {/* Sin Edge Function no hay dónde correr la llamada a Anthropic ni dónde esconder
                      la key (ADR 0010): en modo local el ítem no existe, en vez de existir y fallar. */}
                  <DropdownMenuItem
                    hidden={!store.canGenerateFlashcards}
                    disabled={notes.length === 0 || generateFlashcards.isPending}
                    onClick={() => generateFlashcards.mutate()}
                  >
                    <Sparkles />
                    {generateFlashcards.isPending ? "Generando…" : "Generar flashcards"}
                  </DropdownMenuItem>
                  {/* Acá se cierra y se reabre el notebook: el fin es cuando apretás el botón, no un
                      date picker. Reabrir limpia `finished_at` — si no, un notebook activo quedaría
                      con fecha de fin. */}
                  <DropdownMenuItem
                    onSelect={() =>
                      updateNotebook.mutate(
                        notebook.status === "done"
                          ? { id: notebook.id, status: "active", finished_at: null }
                          : {
                              id: notebook.id,
                              status: "done",
                              finished_at: new Date().toISOString(),
                            },
                      )
                    }
                  >
                    {notebook.status === "done" ? <RotateCcw /> : <Check />}
                    {notebook.status === "done" ? "Reabrir notebook" : "Marcar finalizado"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                    <Trash2 />
                    Borrar notebook
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              {/* Chips: estado (verde si activo), cantidad, y % repasado a la derecha en muted. */}
              <Badge
                variant={notebook.status === "active" ? "brand" : "default"}
                className="rounded-full normal-case"
              >
                ● {STATUS[notebook.status]}
              </Badge>
              <Badge className="rounded-full normal-case">{notes.length} notas</Badge>
              <span className="mono-dim ml-auto text-[10px]">{pct}% repasado</span>
            </div>
          </div>

          <div className="shrink-0 px-4 pb-1">
            <InputGroup className="h-7 bg-card">
              <InputGroupAddon>
                <Search className="size-3" />
              </InputGroupAddon>
              <InputGroupInput
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
              />
              <InputGroupAddon align="inline-end">
                <Kbd>/</Kbd>
              </InputGroupAddon>
            </InputGroup>
          </div>

          <div className="flex flex-col gap-px px-2 py-1.5 md:min-h-0 md:flex-1 md:overflow-y-auto md:pb-2">
            {visible.map((n, i) => {
              const f = freshness(stats?.byNote.get(n.id)?.last)
              return (
                <div key={n.id} data-active={n.id === selected?.id} className={NOTE_ROW}>
                  <button
                    onClick={() => select(n)}
                    className="col-span-2 flex min-w-0 items-center gap-2.5 rounded-lg text-left"
                  >
                    <span className="mono-dim text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                    <span className="truncate">{n.title || "(sin título)"}</span>
                  </button>
                  {/* Celda fija (56×22): frescura y menú comparten celda y se intercambian sin
                      reflow — ni la fila ni el título (1fr) cambian de tamaño con el hover. */}
                  <div className="col-start-3 row-start-1 grid h-[22px] w-14 place-items-center justify-self-end">
                    <span
                      className={cn(
                        "mono text-[10px]",
                        f?.cls,
                        f && "group-hover/note:hidden group-has-[[aria-expanded=true]]/note:hidden",
                      )}
                    >
                      {f?.label}
                    </span>
                    <span className="hidden group-focus-within/note:grid group-has-[[aria-expanded=true]]/note:grid group-hover/note:grid">
                      <NoteActions
                        note={n}
                        // El índice lista refs sin content: se pide la nota entera recién al
                        // copiar/exportar — igual que el editor, que es el único que la necesita.
                        content={() => store.note(n.id).then((full) => full.content)}
                        hideNotebook
                        confirming={confirmingNote === n.id}
                        onConfirmingChange={(open) => setConfirmingNote(open ? n.id : null)}
                        onFocus={() => setFocus(true)}
                        onDeleted={() => navigate(`/notebook/${id}`)}
                      />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-auto shrink-0 border-t p-4 md:mt-0">
            <Button
              size="lg"
              className="w-full"
              onClick={() =>
                createNote.mutate(id!, {
                  onSuccess: (newId) => navigate(`/notebook/${id}/${newId}`),
                })
              }
            >
              <Plus />
              Nueva nota
              <Kbd className="ml-auto">N</Kbd>
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
            onConfirm={() =>
              deleteNotebook.mutate(notebook.id, { onSuccess: () => navigate("/notebooks") })
            }
          />
        </aside>
      )}
    </div>
  )
}
