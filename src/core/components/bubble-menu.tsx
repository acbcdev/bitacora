import { useCallback, useEffect, useRef, useState } from "react"
import { BubbleMenu } from "@tiptap/react/menus"
import { useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import {
  CheckIcon,
  ChevronRightIcon,
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

// Bubble de formato (spec .scratch/editor-notion-ux, historia 4; mockup 07). Panel Notion:
// fila de bloque arriba (muestra el tipo actual y convierte — el usuario lo eligió sobre el
// contrato del grill, que lo dejaba en el menú slash/bloque) + grilla de formato inline con
// estado activo neutro (fondo muted + hairline, sin color de marca) y dots de color bajo los
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
const BUBBLE_OPTIONS = { placement: "top", offset: 8 } as const

function preventFocus(e: React.MouseEvent) {
  e.preventDefault()
}

// Clases compartidas de los botones de la grilla: hover con el accent del UI; activo =
// mismo fondo + hairline inset (mockup 07), sin color de marca.
const btnCls =
  "group relative grid h-[34px] w-full place-items-center rounded-[7px] text-fg-secondary outline-none transition-colors hover:bg-muted hover:text-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_0_0_1px_var(--border)]"

// Dot de color bajo el glifo: pinta el color activo de la ficha (calibrado por tema).
function ColorDot({ color }: { color: string }) {
  return (
    <span
      data-testid="color-dot"
      className="absolute bottom-[3px] left-1/2 h-[8px] w-[9px] -translate-x-1/2 rounded-[4px] border-[1.5px] border-popover"
      style={{ backgroundColor: color }}
    />
  )
}

// ── Fila de bloque: muestra el tipo actual y abre la conversión ────────────────

type BlockKind = {
  name: string
  isActive: (ed: Editor) => boolean
  // null = ya es ese bloque (se muestra con check y no hace nada).
  apply: (ed: Editor) => boolean
}

const BLOCKS: BlockKind[] = [
  {
    name: "Texto normal",
    isActive: (ed) => ed.isActive("paragraph"),
    apply: (ed) => ed.chain().focus().setParagraph().run(),
  },
  {
    name: "Encabezado 1",
    isActive: (ed) => ed.isActive("heading", { level: 1 }),
    apply: (ed) => ed.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    name: "Encabezado 2",
    isActive: (ed) => ed.isActive("heading", { level: 2 }),
    apply: (ed) => ed.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    name: "Encabezado 3",
    isActive: (ed) => ed.isActive("heading", { level: 3 }),
    apply: (ed) => ed.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    name: "Lista con viñetas",
    isActive: (ed) => ed.isActive("bulletList"),
    apply: (ed) => ed.chain().focus().toggleBulletList().run(),
  },
  {
    name: "Lista numerada",
    isActive: (ed) => ed.isActive("orderedList"),
    apply: (ed) => ed.chain().focus().toggleOrderedList().run(),
  },
  {
    name: "To-do",
    isActive: (ed) => ed.isActive("taskList"),
    apply: (ed) => ed.chain().focus().toggleTaskList().run(),
  },
  {
    name: "Cita",
    isActive: (ed) => ed.isActive("blockquote"),
    apply: (ed) => ed.chain().focus().toggleBlockquote().run(),
  },
  {
    name: "Código",
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
      <Popover
        open={colorOpen}
        onOpenChange={(o) => {
          popoverOpen.current = o
          setColorOpen(o)
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(btnCls, "pb-[7px]")}
            aria-label="Color de letra"
            title="Color de letra"
            onMouseDown={preventFocus}
          >
            <span className="text-[15px] leading-none font-extrabold">A</span>
            {active.color && <ColorDot color={active.color} />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto gap-0 rounded-lg p-1.5"
          onMouseDown={preventFocus}
          // El foco queda en el editor: si Radix enfocara el content, el bubble (fuera del
          // alcance de su isChildOfMenu) se ocultaba al abrir y quedaba desmontado.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <PaletteGrid kind="color" active={active.color} onPick={pick} />
          <ClearButton kind="color" onClear={() => editor.chain().focus().unsetColor().run()} />
        </PopoverContent>
      </Popover>
      <Popover
        open={highlightOpen}
        onOpenChange={(o) => {
          popoverOpen.current = o
          setHighlightOpen(o)
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(btnCls, "pb-[3px]")}
            aria-label="Resaltado"
            title="Resaltado (mod+shift+h)"
            onMouseDown={preventFocus}
          >
            <HighlighterIcon />
            {active.highlight && <ColorDot color={active.highlight} />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto gap-0 rounded-lg p-1.5"
          onMouseDown={preventFocus}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <PaletteGrid kind="highlight" active={active.highlight} onPick={pick} />
          <ClearButton
            kind="highlight"
            onClear={() => editor.chain().focus().unsetHighlight().run()}
          />
        </PopoverContent>
      </Popover>
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
      updateDelay={0}
      options={BUBBLE_OPTIONS}
      className="z-50"
    >
      {/* mousedown → preventDefault: el bubble nunca roba la selección (AC transversal). */}
      <div
        onMouseDown={preventFocus}
        data-testid="bubble-menu"
        className="w-[236px] overflow-hidden rounded-[10px] border border-border bg-popover shadow-md"
      >
        {/* Fila de bloque (mockup 07): label del tipo actual + conversión en popover. */}
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
              className="flex w-[236px] items-center gap-2.5 rounded-t-[9px] border-b border-border px-3 py-[9px] text-left text-[13.5px] font-semibold outline-none transition-colors hover:bg-muted"
            >
              <span className="text-muted-foreground">
                <TypeIcon size={17} />
              </span>
              {active.block}
              <ChevronRightIcon size={15} className="ml-auto text-muted-foreground" />
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
                      <TurnBlockIcon index={i} />
                    </span>
                    {b.name}
                    {current && <CheckIcon size={14} className="ml-auto text-muted-foreground" />}
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
        {/* Grilla 4×2: A B I S / code H ✕. */}
        <div className="grid grid-cols-4 gap-[2px] p-1">{toggles}</div>
      </div>
    </BubbleMenu>
  )
}

// Íconos por ítem del convertidor, por posición en BLOCKS.
function TurnBlockIcon({ index }: { index: number }) {
  const icons = [
    TypeIcon,
    Heading1Icon,
    Heading2Icon,
    Heading3Icon,
    ListIcon,
    ListOrderedIcon,
    ListTodoIcon,
    QuoteIcon,
    CodeIcon,
  ]
  const Icon = icons[index]
  return <Icon size={15} />
}
