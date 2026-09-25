import { useEffect, useRef, useState } from "react"
import Suggestion from "@tiptap/suggestion"
import type { SuggestionProps } from "@tiptap/suggestion"
import { PluginKey } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { ReactRenderer, Extension } from "@tiptap/react"
import type { Range, Editor } from "@tiptap/react"
import { toast } from "sonner"
import { store } from "@/core/store"
import { Command, CommandEmpty, CommandItem, CommandList } from "@/core/ui/command"
import {
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Image as ImageIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  QuoteIcon,
  TableIcon,
} from "lucide-react"

// Menú slash (spec .scratch/editor-notion-ux, historia 2). Detección de trigger/query =
// @tiptap/suggestion; la UI es un popup cmdk montado en portal con props.mount, posicionado
// con bottom-start / offset 4 / flip (defaults del plugin). Transformaciones convierten el
// bloque entero del cursor; inserciones parten el párrafo en el cursor.

type SlashActionArgs = { editor: Editor; range: Range }

type SlashItem = {
  title: string
  // Keywords para el filtrado excluyente (`h1` matchea "Heading 1").
  keywords: string
  icon: typeof Heading1Icon
  action: (args: SlashActionArgs) => void
}

// El texto `/query` se borra antes de cada acción (deleteRange), como en Notion.
const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Heading 1",
    keywords: "h1 titulo1 encabezado",
    icon: Heading1Icon,
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    keywords: "h2 titulo2 encabezado",
    icon: Heading2Icon,
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    keywords: "h3 titulo3 encabezado",
    icon: Heading3Icon,
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    title: "Lista con viñetas",
    keywords: "bullet ul lista puntos",
    icon: ListIcon,
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Lista numerada",
    keywords: "numerada ol ordered lista",
    icon: ListOrderedIcon,
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "To-do",
    keywords: "todo tarea checkbox task pendiente",
    icon: ListTodoIcon,
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Cita",
    keywords: "cita quote blockquote",
    icon: QuoteIcon,
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Código",
    keywords: "codigo code codeblock bloque",
    icon: CodeIcon,
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Divisor",
    keywords: "divisor hr linea separador divider horizontal",
    icon: MinusIcon,
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "Tabla",
    keywords: "tabla table grid cuadricula",
    icon: TableIcon,
    action: ({ editor, range }) =>
      // 2x2 sin header row (decisión del grill): el header se togglea desde la toolbar de tablas.
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 2, cols: 2, withHeaderRow: false })
        .run(),
  },
  {
    title: "Imagen",
    keywords: "imagen image foto picture upload",
    icon: ImageIcon,
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      // File picker propio; mismo path de upload que el paste de imagen (handlePaste).
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/*"
      input.addEventListener("change", () => {
        const file = input.files?.[0]
        if (!file) return
        toast.promise(
          store.uploadNoteImage(file).then((src) => {
            editor.chain().focus().setImage({ src }).run()
          }),
          {
            loading: "Subiendo imagen…",
            success: "Imagen insertada",
            error: (e) => (e instanceof Error ? e.message : "No se pudo subir la imagen"),
          },
        )
      })
      input.click()
    },
  },
]

// Filtrado excluyente case-insensitive: todo token del query debe matchear título o keywords.
function filterItems(query: string): SlashItem[] {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return SLASH_ITEMS
  return SLASH_ITEMS.filter((item) => {
    const hay = `${item.title} ${item.keywords}`.toLowerCase()
    return tokens.every((t) => hay.includes(t))
  })
}

type PopupProps = {
  items: SlashItem[]
  command: (item: SlashItem) => void
  keyRef: { current: ((event: KeyboardEvent) => boolean) | null }
}

function SlashPopup({ items, command, keyRef }: PopupProps) {
  const [index, setIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  // Items cambiaron (nuevo query) → selección vuelve al primero.
  useEffect(() => {
    setIndex(0)
  }, [items])

  // Scroll del ítem seleccionado: cmdk solo scrollea al mover la selección con SU keymap
  // interno, que nunca corre (el foco vive en el editor). Sin esto, con más de ~9 ítems la
  // selección se va fuera de la lista (max-h-72) sin scroll.
  useEffect(() => {
    rootRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" })
  }, [index, items])

  // Sin deps: el handler se re-registra con el closure fresco en cada render. Los keydown
  // llegan por el editor (el foco nunca sale del editor), así que cmdk no ve teclas —
  // el Suggestion plugin delega acá vía keyRef.
  useEffect(() => {
    keyRef.current = (event) => {
      // Espacio con match único confirma la selección; sin match único, false → PM inserta el
      // espacio y el match muere → popup cierra ("espacio cierra", contrato del grill).
      if (event.key === " ") {
        if (items.length === 1) {
          command(items[0]!)
          return true
        }
        return false
      }
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setIndex((i) => (items.length ? (i + 1) % items.length : 0))
        return true
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0))
        return true
      }
      if (event.key === "Enter") {
        const item = items[index]
        if (!item) return false
        event.preventDefault()
        command(item)
        return true
      }
      return false
    }
  })

  const selected = items[index]?.title ?? ""

  return (
    <div
      ref={rootRef}
      data-testid="slash-menu"
      // Mousedown → preventDefault: el popup nunca roba el foco de la selección (AC transversal).
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* value/onValueChange controlados: el highlight visual de cmdk sigue al index que maneja
          el teclado (flechas/Enter delegado por el plugin via keyRef), y el hover del mouse
          actualiza el index — una sola fuente de verdad. */}
      <Command
        shouldFilter={false}
        value={selected}
        onValueChange={(v) => {
          const i = items.findIndex((item) => item.title === v)
          if (i >= 0) setIndex(i)
        }}
        className="w-64 rounded-xl! border shadow-lg"
      >
        <CommandList>
          {items.map((item) => (
            <CommandItem
              key={item.title}
              value={item.title}
              onSelect={() => command(item)}
              className="data-selected:bg-muted"
            >
              <item.icon />
              {item.title}
            </CommandItem>
          ))}
          <CommandEmpty>Sin resultados</CommandEmpty>
        </CommandList>
      </Command>
    </div>
  )
}

export const slashMenuPluginKey = new PluginKey("slashMenu")

// True mientras el popup del menú slash está abierto. El editor lo usa para delegar Escape
// (el keymap global del editor corre antes que el plugin en view.someProp).
export function isSlashMenuActive(view: EditorView) {
  return slashMenuPluginKey.getState(view.state)?.active ?? false
}

export const SlashMenu = Extension.create({
  name: "slashMenu",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        pluginKey: slashMenuPluginKey,
        char: "/",
        // Trigger por defecto de Suggestion: `/` al inicio de bloque o precedido de espacio,
        // nunca a mitad de palabra (allowedPrefixes [' ']). allowSpaces false = query hasta
        // espacio o fin de línea.
        items: ({ query }) => filterItems(query),
        initialItems: SLASH_ITEMS,
        command: ({ editor, range, props: item }) => {
          item.action({ editor, range })
        },
        render: () => {
          let renderer: ReactRenderer | null = null
          let unmountPopup: (() => void) | null = null
          const keyRef: { current: ((event: KeyboardEvent) => boolean) | null } = { current: null }

          return {
            onStart(props: SuggestionProps<SlashItem>) {
              renderer = new ReactRenderer(SlashPopup, {
                props: { items: props.items, command: props.command, keyRef },
                editor: props.editor,
              })
              // El plugin monta en portal (document.body) y posiciona con Floating UI
              // (bottom-start, offset 4, flip) contra el rect del cursor.
              unmountPopup = props.mount(renderer.element)
            },
            onUpdate(props: SuggestionProps<SlashItem>) {
              renderer?.updateProps({ items: props.items, command: props.command })
            },
            onExit() {
              unmountPopup?.()
              renderer?.destroy()
              renderer = null
              unmountPopup = null
              keyRef.current = null
            },
            onKeyDown: ({ event }) => keyRef.current?.(event) ?? false,
          }
        },
      }),
    ]
  },
})
