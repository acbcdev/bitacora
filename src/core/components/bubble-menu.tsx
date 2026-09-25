import { useCallback, useEffect, useRef, useState } from "react"
import { BubbleMenu } from "@tiptap/react/menus"
import { useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import {
  BoldIcon,
  CodeIcon,
  HighlighterIcon,
  ItalicIcon,
  StrikethroughIcon,
  TypeIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/core/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@/core/ui/toggle-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/core/ui/popover"

// Bubble de formato (spec .scratch/editor-notion-ux, historia 4). Aparece con selección no
// vacía (default shouldShow del plugin de BubbleMenu) y ofrece solo formato inline: B · I ·
// S · code · A (color) · H (highlight) · ✕ (limpiar). El turn-into vive en el menú slash y
// el menú de bloque. Color y highlight son marks oficiales (textStyle/Highlight) con la
// paleta fija de 8 de abajo.

// Paleta fija de 8, tipo Notion: cada color tiene su hex de letra y de fondo. Los hex viajan
// en los attrs de las marks (doc JSON); el export .md los pierde, aceptado (ADR 0018).
export const PALETTE = [
  { name: "Gris", text: "#787774", bg: "#F1F1EF" },
  { name: "Marrón", text: "#9F6B53", bg: "#F4EEEE" },
  { name: "Naranja", text: "#D9730D", bg: "#FBECDD" },
  { name: "Amarillo", text: "#CB912F", bg: "#FBF3DB" },
  { name: "Verde", text: "#448361", bg: "#EDF3EC" },
  { name: "Azul", text: "#337EA9", bg: "#E7F3F8" },
  { name: "Violeta", text: "#9065B0", bg: "#F4F0F7" },
  { name: "Rojo", text: "#D44C47", bg: "#FDEBEC" },
] as const

// Fila de 7 con ToggleGroup de shadcn (decisión del grill). Los valores de A/H/✕ nunca
// entran al `value` del grupo: son acciones con popover, no toggles — radix les calcula
// estado off permanente y nosotros ignoramos sus clicks en onValueChange.

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

// Constante de módulo: BubbleMenu despacha un meta-transaction si cambia el objeto options
// (identidad), así que un literal en JSX re-dispachearía en cada render del editor.
const BUBBLE_OPTIONS = { placement: "top", offset: 8 } as const

function preventFocus(e: React.MouseEvent) {
  e.preventDefault()
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
    }),
  })
  const [colorOpen, setColorOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)

  // Esc con popover abierto: cierra el popover y nada más (capture: el editor no ve la tecla y
  // no blur-ea). Sin esto, Esc caía al editor y lo sacaba de foco con el popover flotando.
  const open = colorOpen || highlightOpen
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopPropagation()
      setColorOpen(false)
      setHighlightOpen(false)
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

  function onValueChange(next: string[]) {
    const chain = editor.chain().focus()
    if (next.includes("bold") !== active.bold) chain.toggleBold()
    if (next.includes("italic") !== active.italic) chain.toggleItalic()
    if (next.includes("strike") !== active.strike) chain.toggleStrike()
    if (next.includes("code") !== active.code) chain.toggleCode()
    chain.run()
  }

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

  const value = [
    active.bold && "bold",
    active.italic && "italic",
    active.strike && "strike",
    active.code && "code",
  ].filter(Boolean) as string[]

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      updateDelay={0}
      options={BUBBLE_OPTIONS}
      className="z-50"
    >
      {/* mousedown → preventDefault: el bubble nunca roba la selección (AC transversal). */}
      <div onMouseDown={preventFocus} data-testid="bubble-menu">
        <ToggleGroup
          type="multiple"
          variant="outline"
          spacing={0}
          value={value}
          onValueChange={onValueChange}
          className="rounded-lg border bg-popover p-0.5 shadow-md"
        >
          <ToggleGroupItem
            value="bold"
            aria-label="Bold"
            className="size-7 p-0"
            onMouseDown={preventFocus}
          >
            <BoldIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="italic"
            aria-label="Itálica"
            className="size-7 p-0"
            onMouseDown={preventFocus}
          >
            <ItalicIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="strike"
            aria-label="Tachado"
            className="size-7 p-0"
            onMouseDown={preventFocus}
          >
            <StrikethroughIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="code"
            aria-label="Código inline"
            className="size-7 p-0"
            onMouseDown={preventFocus}
          >
            <CodeIcon />
          </ToggleGroupItem>

          <Popover
            open={colorOpen}
            onOpenChange={(o) => {
              popoverOpen.current = o
              setColorOpen(o)
            }}
          >
            <PopoverTrigger asChild>
              <ToggleGroupItem
                value="color"
                aria-label="Color de letra"
                className="size-7 p-0"
                onMouseDown={preventFocus}
              >
                {/* Mini-preview: el ícono pinta el color activo, como en Notion. */}
                <TypeIcon style={active.color ? { color: active.color } : undefined} />
              </ToggleGroupItem>
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
              <ToggleGroupItem
                value="highlight"
                aria-label="Resaltado"
                className="size-7 p-0"
                onMouseDown={preventFocus}
              >
                <HighlighterIcon
                  style={
                    active.highlight
                      ? {
                          color: "#4b4b4b",
                          backgroundColor: active.highlight,
                          borderRadius: 3,
                          padding: 2,
                        }
                      : undefined
                  }
                />
              </ToggleGroupItem>
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

          <ToggleGroupItem
            value="clear"
            aria-label="Limpiar formato"
            className="size-7 p-0"
            onMouseDown={preventFocus}
            onClick={() => editor.chain().focus().unsetAllMarks().run()}
          >
            <XIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </BubbleMenu>
  )
}
