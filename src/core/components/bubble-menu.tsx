import { useCallback, useEffect, useRef, useState } from "react"
import { BubbleMenu } from "@tiptap/react/menus"
import { useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import {
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  QuoteIcon,
  TypeIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/core/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/core/ui/popover"
import { preventFocus } from "@/core/components/prevent-focus"

// Bubble de formato (spec .scratch/editor-notion-ux, historia 4). Toolbar de UNA fila (variante A
// del prototipo, elegida sobre panel por secciones y menú de comandos): select de bloque a la
// izquierda (muestra el tipo actual y convierte — el usuario lo eligió sobre el contrato del
// grill, que lo dejaba en el menú slash/bloque) + marks inline con estado activo neutro (fondo muted + hairline, sin color de marca) y dots de color bajo los
// botones de A/H. Color y highlight son marks oficiales (textStyle/Highlight); los attrs
// persisten la cadena var(--p-*) y el CSS la resuelve por tema (paleta bicolor en index.css).

// Paleta fija de 8, tipo Notion: cada ficha tiene su color de letra y de fondo como var() —
// el hex concreto lo define index.css según el tema. El export .md los pierde, aceptado (ADR 0018).
export const PALETTE = [
  { name: "Gris", text: "var(--p-gray)", bg: "var(--p-gray-hl)" },
  { name: "Marrón", text: "var(--p-brown)", bg: "var(--p-brown-hl)" },
  { name: "Naranja", text: "var(--p-orange)", bg: "var(--p-orange-hl)" },
  { name: "Amarillo", text: "var(--p-yellow)", bg: "var(--p-yellow-hl)" },
  { name: "Verde", text: "var(--p-green)", bg: "var(--p-green-hl)" },
  { name: "Azul", text: "var(--p-blue)", bg: "var(--p-blue-hl)" },
  { name: "Violeta", text: "var(--p-violet)", bg: "var(--p-violet-hl)" },
  { name: "Rojo", text: "var(--p-red)", bg: "var(--p-red-hl)" },
] as const

// Constante de módulo: BubbleMenu despacha un meta-transaction si cambia el objeto options
// (identidad), así que un literal en JSX re-dispachearía en cada render del editor.
// top-start: anclado al inicio de la selección — formatear (p.ej. code, que ensancha el texto)
// no recentra ni mueve el bubble.
const BUBBLE_OPTIONS = { placement: "top-start", offset: 8 } as const

// Clases compartidas de los botones de la grilla: hover con el accent del UI; activo =
// mismo fondo + hairline inset (mockup 07), sin color de marca.
const btnCls =
  "group relative grid h-[32px] w-[32px] place-items-center rounded-[7px] text-fg-secondary outline-none transition-colors hover:bg-muted hover:text-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_0_0_1px_var(--border)]"

// Dot de color bajo el glifo: pinta el color activo de la ficha (calibrado por tema).
function ColorDot({ color }: { color: string }) {
  return (
    <span
      data-testid="color-dot"
      className="absolute -top-[3px] -right-[5px] size-[9px] rounded-full border-[1.5px] border-popover"
      style={{ backgroundColor: color }}
    />
  )
}

const Sep = () => <span aria-hidden className="mx-0.5 h-[18px] w-px shrink-0 bg-border" />

// ── Fila de bloque: muestra el tipo actual y abre la conversión ────────────────

type BlockKind = {
  name: string
  icon: typeof TypeIcon
  isActive: (ed: Editor) => boolean
  // null = ya es ese bloque (se muestra con check y no hace nada).
  apply: (ed: Editor) => boolean
}

const BLOCKS: BlockKind[] = [
  {
    name: "Texto normal",
    icon: TypeIcon,
    isActive: (ed) => ed.isActive("paragraph"),
    apply: (ed) => ed.chain().focus().setParagraph().run(),
  },
  {
    name: "Encabezado 1",
    icon: Heading1Icon,
    isActive: (ed) => ed.isActive("heading", { level: 1 }),
    apply: (ed) => ed.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    name: "Encabezado 2",
    icon: Heading2Icon,
    isActive: (ed) => ed.isActive("heading", { level: 2 }),
    apply: (ed) => ed.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    name: "Encabezado 3",
    icon: Heading3Icon,
    isActive: (ed) => ed.isActive("heading", { level: 3 }),
    apply: (ed) => ed.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    name: "Lista con viñetas",
    icon: ListIcon,
    isActive: (ed) => ed.isActive("bulletList"),
    apply: (ed) => ed.chain().focus().toggleBulletList().run(),
  },
  {
    name: "Lista numerada",
    icon: ListOrderedIcon,
    isActive: (ed) => ed.isActive("orderedList"),
    apply: (ed) => ed.chain().focus().toggleOrderedList().run(),
  },
  {
    name: "To-do",
    icon: ListTodoIcon,
    isActive: (ed) => ed.isActive("taskList"),
    apply: (ed) => ed.chain().focus().toggleTaskList().run(),
  },
  {
    name: "Cita",
    icon: QuoteIcon,
    isActive: (ed) => ed.isActive("blockquote"),
    apply: (ed) => ed.chain().focus().toggleBlockquote().run(),
  },
  {
    name: "Código",
    icon: CodeIcon,
    isActive: (ed) => ed.isActive("codeBlock"),
    apply: (ed) => ed.chain().focus().toggleCodeBlock().run(),
  },
]

// ── Paleta en popover (8 fichas fijas; ficha ya activa = quita, contrato del grill) ──

function PaletteGrid({
  kind,
  active,
  onPick,
}: {
  kind: "color" | "highlight"
  active: string | null
  onPick: (kind: "color" | "highlight", index: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {PALETTE.map((p, i) => {
        const swatch = kind === "color" ? p.text : p.bg
        const isActive = active === swatch
        return (
          <button
            key={p.name}
            type="button"
            title={p.name}
            aria-label={p.name}
            data-testid={`palette-${kind}-${i}`}
            data-active={isActive || undefined}
            onClick={() => onPick(kind, i)}
            className={cn(
              "size-6 rounded-full border border-foreground/20 transition-shadow",
              isActive && "ring-2 ring-ring",
            )}
            style={{ backgroundColor: swatch }}
          />
        )
      })}
    </div>
  )
}

function ClearButton({ kind, onClear }: { kind: "color" | "highlight"; onClear: () => void }) {
  return (
    <button
      type="button"
      data-testid={`clear-${kind}`}
      onClick={onClear}
      className="mt-1 w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
    >
      Quitar
    </button>
  )
}

// Envoltura compartida de los dos popovers de paleta (color / highlight): difieren sólo en el
// trigger (children), el kind y los accesos; el shell — ref de popover abierto, foco que queda
// en el editor, PaletteGrid + ClearButton — es el mismo.
function ColorPopover({
  kind,
  active,
  open,
  onOpenChange,
  onPick,
  onClear,
  popoverOpen,
  children,
}: {
  kind: "color" | "highlight"
  active: string | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onPick: (kind: "color" | "highlight", index: number) => void
  onClear: () => void
  popoverOpen: React.RefObject<boolean>
  children: React.ReactNode
}) {
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        popoverOpen.current = o
        onOpenChange(o)
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-auto gap-0 rounded-lg p-1.5"
        onMouseDown={preventFocus}
        // El foco queda en el editor: si Radix enfocara el content, el bubble (fuera del
        // alcance de su isChildOfMenu) se ocultaba al abrir y quedaba desmontado.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <PaletteGrid kind={kind} active={active} onPick={onPick} />
        <ClearButton kind={kind} onClear={onClear} />
      </PopoverContent>
    </Popover>
  )
}

export function FormatBubbleMenu({ editor }: { editor: Editor }) {
  // El estado activo de cada control sale de editor.isActive, leído por transacción.
  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed.isActive("bold"),
      italic: ed.isActive("italic"),
      strike: ed.isActive("strike"),
      code: ed.isActive("code"),
      color: PALETTE.find((p) => ed.isActive("textStyle", { color: p.text }))?.text ?? null,
      highlight: PALETTE.find((p) => ed.isActive("highlight", { color: p.bg }))?.bg ?? null,
      block: BLOCKS.find((b) => b.isActive(ed))?.name ?? "Texto normal",
    }),
  })
  const [colorOpen, setColorOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)
  const [turnOpen, setTurnOpen] = useState(false)

  // Esc con popover abierto: cierra el popover y nada más (capture: el editor no ve la tecla y
  // no blur-ea). Sin esto, Esc caía al editor y lo sacaba de foco con el popover flotando.
  const open = colorOpen || highlightOpen || turnOpen
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopPropagation()
      setColorOpen(false)
      setHighlightOpen(false)
      setTurnOpen(false)
      popoverOpen.current = false
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open])

  // Los popovers se portalan a document.body — fuera del elemento del bubble. shouldShow del
  // plugin entonces no los ve (isChildOfMenu) y ocultaría el bubble al abrir uno. Con el ref,
  // mientras haya popover abierto el bubble se queda.
  const popoverOpen = useRef(false)
  const shouldShow = useCallback(
    ({
      editor: ed,
      state,
      view,
      from,
      to,
    }: {
      editor: Editor
      state: Parameters<NonNullable<Parameters<typeof BubbleMenu>[0]["shouldShow"]>>[0]["state"]
      view: Parameters<NonNullable<Parameters<typeof BubbleMenu>[0]["shouldShow"]>>[0]["view"]
      from: number
      to: number
    }) => {
      if (popoverOpen.current) return true
      if (!ed.isEditable || state.selection.empty || !view.hasFocus()) return false
      // Selección de bloques (node-range) o drag en curso: NUNCA bubble — es modal de
      // TEXTO. view.dragging es truthy solo durante el drag nativo del asa.
      if (state.selection instanceof NodeRangeSelection || view.dragging) return false
      return state.doc.textBetween(from, to).length > 0
    },
    [],
  )

  // Ficha ya activa = quita (contrato del grill); al aplicar cierra el popover.
  function pick(kind: "color" | "highlight", index: number) {
    const p = PALETTE[index]
    const chain = editor.chain().focus()
    if (kind === "color") {
      if (active.color === p.text) chain.unsetColor()
      else chain.setColor(p.text)
    } else {
      if (active.highlight === p.bg) chain.unsetHighlight()
      else chain.setHighlight({ color: p.bg })
    }
    chain.run()
    popoverOpen.current = false
    if (kind === "color") setColorOpen(false)
    else setHighlightOpen(false)
  }

  function applyBlock(index: number) {
    const b = BLOCKS[index]
    b.apply(editor)
    popoverOpen.current = false
    setTurnOpen(false)
  }

  const toggles = (
    <>
      <button
        type="button"
        className={btnCls}
        data-state={active.bold ? "on" : "off"}
        aria-label="Bold"
        title="Bold (mod+alt+b)"
        onMouseDown={preventFocus}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="text-[15px] leading-none font-bold">B</span>
      </button>
      <button
        type="button"
        className={btnCls}
        data-state={active.italic ? "on" : "off"}
        aria-label="Itálica"
        title="Itálica (mod+i)"
        onMouseDown={preventFocus}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="font-serif text-[15px] leading-none italic">I</span>
      </button>
      <button
        type="button"
        className={btnCls}
        data-state={active.strike ? "on" : "off"}
        aria-label="Tachado"
        title="Tachado (mod+shift+x)"
        onMouseDown={preventFocus}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="text-[15px] leading-none font-bold line-through decoration-2">S</span>
      </button>
      <button
        type="button"
        className={btnCls}
        data-state={active.code ? "on" : "off"}
        aria-label="Código inline"
        title="Código (mod+e)"
        onMouseDown={preventFocus}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon />
      </button>
      <Sep />
      <ColorPopover
        kind="color"
        active={active.color}
        open={colorOpen}
        onOpenChange={setColorOpen}
        onPick={pick}
        onClear={() => editor.chain().focus().unsetColor().run()}
        popoverOpen={popoverOpen}
      >
        <button
          type="button"
          className={cn(btnCls, "flex w-auto items-center gap-0.5 px-1.5")}
          aria-label="Color de letra"
          title="Color de letra"
          onMouseDown={preventFocus}
        >
          <span className="relative grid size-4 place-items-center">
            <span className="text-[15px] leading-none font-extrabold">A</span>
            {active.color && <ColorDot color={active.color} />}
          </span>
          <ChevronDownIcon size={11} className="text-muted-foreground" />
        </button>
      </ColorPopover>
      <ColorPopover
        kind="highlight"
        active={active.highlight}
        open={highlightOpen}
        onOpenChange={setHighlightOpen}
        onPick={pick}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
        popoverOpen={popoverOpen}
      >
        <button
          type="button"
          className={cn(btnCls, "flex w-auto items-center gap-0.5 px-1.5")}
          aria-label="Resaltado"
          title="Resaltado (mod+shift+h)"
          onMouseDown={preventFocus}
        >
          <span className="relative grid size-4 place-items-center">
            <HighlighterIcon />
            {active.highlight && <ColorDot color={active.highlight} />}
          </span>
          <ChevronDownIcon size={11} className="text-muted-foreground" />
        </button>
      </ColorPopover>
      <Sep />
      <button
        type="button"
        className={btnCls}
        aria-label="Limpiar formato"
        title="Limpiar formato (mod+\)"
        onMouseDown={preventFocus}
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
      >
        <XIcon />
      </button>
    </>
  )

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      // Delay de aparición: con 0 el bubble saltaba al instante con cualquier selección
      // (molesto cuando no lo querés). ~350ms = tiempo de Notion para aparecer tras
      // asentar la selección; el plugin debouncer el update con este delay.
      updateDelay={350}
      options={BUBBLE_OPTIONS}
      className="z-50"
    >
      {/* mousedown → preventDefault: el bubble nunca roba la selección (AC transversal). */}
      <div
        onMouseDown={preventFocus}
        data-testid="bubble-menu"
        className="flex items-center gap-0.5 rounded-full border border-border bg-popover p-1 shadow-md"
      >
        {/* Select de bloque: label del tipo actual + conversión en popover. */}
        <Popover
          open={turnOpen}
          onOpenChange={(o) => {
            popoverOpen.current = o
            setTurnOpen(o)
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="turn-into"
              aria-label="Convertir bloque"
              className="flex h-[32px] items-center gap-[7px] rounded-full pr-2.5 pl-3 text-[13px] font-semibold whitespace-nowrap outline-none transition-colors hover:bg-muted"
            >
              <span className="text-muted-foreground">
                <TypeIcon size={16} />
              </span>
              {active.block}
              <ChevronDownIcon size={14} className="text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[200px] gap-0 rounded-lg p-1.5"
            align="start"
            onMouseDown={preventFocus}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-0.5">
              {BLOCKS.map((b, i) => {
                const current = b.name === active.block
                return (
                  <button
                    key={b.name}
                    type="button"
                    data-testid={`turn-item-${i}`}
                    onClick={() => applyBlock(i)}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-muted data-[active]:text-foreground"
                    data-active={current || undefined}
                  >
                    <span className="text-muted-foreground">
                      <b.icon size={15} />
                    </span>
                    {b.name}
                    {current && <CheckIcon size={14} className="ml-auto text-muted-foreground" />}
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
        <Sep />
        {toggles}
      </div>
    </BubbleMenu>
  )
}
