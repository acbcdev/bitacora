import { useEffect, useMemo, useRef, useState } from "react"
import { Image as ImageIcon, Loader2, Shuffle, Smile } from "lucide-react"
import { toast } from "sonner"
import { EMOJIS, EMOJI_GROUPS, EMOJI_KEYWORDS, TONES, TONEABLE } from "@/notebooks/emojis"
import { NotebookIcon, ICON_TINTS, TINT_DOTS } from "@/notebooks/notebook-icon"
import { PRESET_GROUPS } from "@/notebooks/preset-icons"
import { store } from "@/core/store"
import { Button } from "@/core/ui/button"
import { Input } from "@/core/ui/input"
import { Kbd } from "@/core/ui/kbd"
import { cn, MOD } from "@/core/lib/utils"
import { Dropover, DropoverContent, DropoverTrigger } from "@/core/ui/dropover"
import { ScrollArea } from "@/core/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs"

// Pestaña con secciones (título = texto pelado, sin fondo). Celdas fijas (min-content) pegadas
// al start: los íconos van cuerpo a cuerpo, sin estirarse por el ancho del popover — por eso
// 10 columnas × 36px ≈ el ancho útil de w-96 y no queda más gap que el gap-0 del grid. En
// desktop el scroller recorta con h-80 (popover bajo) y el header con pestañas y buscador
// quedan fijos; en mobile el drawer manda el alto.
// Solo la pestaña de emojis lleva el nav inferior de categorías (con scroll-spy que marca el
// activo) y solo con la lista completa; los íconos no.
function GroupedGrid({
  value,
  groups,
  selected,
  onPick,
  render,
  nav,
}: {
  value: string
  groups: { label: string; icon?: string; items: string[] }[]
  selected: (item: string) => boolean
  onPick: (item: string) => void
  render: (item: string) => React.ReactNode
  nav?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(groups[0]?.label)

  // El scroller real es el Viewport del ScrollArea; scroll no burbujea, así que el spy escucha
  // directo ahí.
  const viewport = () =>
    root.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]")

  useEffect(() => {
    const el = viewport()
    if (!el) return
    const onScroll = () => {
      const top = el.getBoundingClientRect().top
      let current = el.querySelector<HTMLElement>("[data-group]")?.dataset.group
      for (const node of el.querySelectorAll<HTMLElement>("[data-group]")) {
        if (node.getBoundingClientRect().top - top <= 4) current = node.dataset.group
      }
      if (current) setActive(current)
    }
    el.addEventListener("scroll", onScroll)
    return () => el.removeEventListener("scroll", onScroll)
  }, [groups])

  function go(label: string) {
    const el = viewport()
    const section = el?.querySelector<HTMLElement>(`[data-group="${CSS.escape(label)}"]`)
    if (!el || !section) return
    el.scrollTo({
      top: section.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 2,
      behavior: "smooth",
    })
    setActive(label)
  }

  return (
    <TabsContent value={value} ref={root} className="flex min-h-0 flex-1 flex-col p-1">
      {/* Alto explícito en desktop (h-80): en un popover de alto auto, flex-1 no define altura
          y el contenido del ScrollArea se sale del contenedor. En mobile el drawer sí da la
          cadena de flex-1 + min-h-0 que hace definite el alto. */}
      <ScrollArea className="min-h-0 flex-1 md:h-80 md:flex-none">
        {groups.map((g) => (
          <div key={g.label}>
            <div
              data-group={g.label}
              className="py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {g.label}
            </div>
            <div className="grid grid-cols-[repeat(7,min-content)] justify-start gap-0 max-md:gap-1 md:grid-cols-[repeat(10,min-content)]">
              {g.items.map((item) => (
                <IconButton
                  key={item}
                  label={item}
                  selected={selected(item)}
                  onClick={() => onPick(item)}
                >
                  {render(item)}
                </IconButton>
              ))}
            </div>
          </div>
        ))}
      </ScrollArea>

      {/* Nav de categorías (solo emojis): íconos lucide, un ícono por grupo. Salta al grupo
            dentro del scroll de arriba; se oculta mientras se busca. Va DENTRO del TabsContent
            para que Radix lo desmonte cuando la pestaña no está activa — como hermano se veía
            en las dos pestañas. */}
      {nav && groups.length > 1 && (
        <nav
          className="mt-1 flex gap-0.5 overflow-x-auto border-t px-1 pt-1"
          aria-label="Categorías"
        >
          {groups.map((g) => (
            <Button
              key={g.label}
              type="button"
              variant="ghost"
              size="icon-sm"
              title={g.label}
              aria-label={g.label}
              aria-current={active === g.label ? "true" : undefined}
              className={cn("shrink-0", active === g.label && "bg-muted text-foreground")}
              onClick={() => go(g.label)}
            >
              <NotebookIcon icon={g.icon ? `lucide:${g.icon}` : null} className="size-4" />
            </Button>
          ))}
        </nav>
      )}
    </TabsContent>
  )
}

function IconButton({
  label,
  selected,
  onClick,
  children,
}: {
  label: string
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={selected}
      className={cn("max-md:size-11 md:size-9", selected && "bg-muted text-foreground")}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

// Popover a lo Notion en desktop, drawer en mobile (Dropover): el trigger es el icono actual y
// adentro van las dos fuentes (presets / imagen propia) en pestañas, más Eliminar. Elegir cierra —
// es un paso del form, no una pantalla.
export function IconPicker({
  icon,
  onChange,
  className,
}: {
  icon: string | null
  onChange: (v: string | null) => void
  className?: string
}) {
  const file = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [tab, setTab] = useState("iconos")
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()

  // Filtrado del buscador: presets por nombre, emojis por su keyword en español (emojis.ts).
  const presetGroups = useMemo(
    () =>
      PRESET_GROUPS.map((g) => ({
        label: g.label,
        items: g.icons.filter((i) => i.toLowerCase().includes(q)),
      })).filter((g) => g.items.length > 0),
    [q],
  )
  const emojiGroups = useMemo(
    () =>
      EMOJI_GROUPS.map((g) => ({
        label: g.label,
        icon: g.icon,
        items: g.emojis.filter((e) => e.includes(q) || EMOJI_KEYWORDS[e].includes(q)),
      })).filter((g) => g.items.length > 0),
    [q],
  )

  function set(v: string | null) {
    onChange(v)
    setOpen(false)
  }

  // Elije uno al azar de la lista de la pestaña (si hay búsqueda, de lo filtrado; si no queda
  // nada, de la lista completa). Aplica directo sin cerrar el popover — es prueba y error.
  function randomPick() {
    const filtered = (tab === "iconos" ? presetGroups : emojiGroups).flatMap((g) => g.items)
    const list = filtered.length
      ? filtered
      : tab === "iconos"
        ? PRESET_GROUPS.flatMap((g) => g.icons)
        : EMOJIS
    let v = list[Math.floor(Math.random() * list.length)]
    if (tab === "iconos") {
      const tint = icon?.split("|")[1]
      v = `lucide:${v}${tint ? `|${tint}` : ""}`
    } else if (TONEABLE.has(v) && toneIndex >= 0) {
      v += TONES[toneIndex] // el random respeta el tono elegido
    }
    onChange(v) // sin setOpen(false): es para probar, no para decidir
  }

  // Tono de piel actual del emoji elegido (−1 = sin tono / no aplica).
  const toneIndex =
    icon?.startsWith("lucide:") || icon?.startsWith("http")
      ? -1
      : TONES.findIndex((t) => icon?.endsWith(t))
  const toneBase = toneIndex >= 0 ? icon!.slice(0, icon!.length - TONES[toneIndex].length) : icon

  // Cicla el tono de piel del emoji elegido; inerte si no hay emoji toneable elegido.
  function cycleTone() {
    if (!toneBase || !TONEABLE.has(toneBase)) return
    onChange(toneBase + TONES[(toneIndex + 1) % TONES.length])
  }

  // Cicla el tinte preset del ícono lucide elegido (tinte vacío → primer color → … → vacío).
  const tint = icon?.startsWith("lucide:") ? icon.slice(7).split("|")[1] : undefined
  const tintIndex = ICON_TINTS.indexOf(tint as (typeof ICON_TINTS)[number])
  function cycleTint() {
    if (!icon?.startsWith("lucide:")) return
    const [name, cur = ""] = icon.slice(7).split("|")
    const next =
      ICON_TINTS[
        (ICON_TINTS.indexOf(cur as (typeof ICON_TINTS)[number]) + 1) % (ICON_TINTS.length + 1)
      ]
    onChange(next ? `lucide:${name}|${next}` : `lucide:${name}`)
  }

  // Las tres entradas (picker, pegar, soltar) terminan acá.
  async function upload(f: File | undefined) {
    if (!f) return
    // El bucket también valida el tipo, pero cortar acá da un error entendible en vez de un 400.
    if (!f.type.startsWith("image/")) return toast.error("Eso no es una imagen")
    setUploading(true)
    try {
      // ponytail: sube al elegir, así que cancelar el diálogo deja el archivo huérfano.
      // Limpiarlos en batch si algún día molesta.
      set(await store.uploadNotebookIcon(await optimize(f)))
    } catch {
      toast.error("No se pudo subir la imagen")
    } finally {
      setUploading(false)
    }
  }

  // Reescala a máx 256px y re-encodea a webp (un ícono nunca necesita más). Si el canvas
  // falla (gif animado, memoria) sube el original y listo.
  async function optimize(f: File): Promise<File | Blob> {
    try {
      const bitmap = await createImageBitmap(f)
      const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85))
      bitmap.close()
      return blob && blob.size < f.size ? blob : f
    } catch {
      return f
    }
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = "" // sin esto, reelegir el mismo archivo no dispara change
    upload(f)
  }

  return (
    <Dropover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setQuery("") // el buscador arranca limpio en cada apertura
      }}
    >
      <DropoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Icono del notebook"
          className={cn("size-10 text-muted-foreground", className)}
        >
          {icon ? (
            <NotebookIcon icon={icon} className="size-6.5 text-2xl leading-none" />
          ) : (
            <Smile className="size-5.5" />
          )}
        </Button>
      </DropoverTrigger>

      {/* Pegar cuelga del popover/drawer entero, no del tab: se enfoca el content al abrir, así
          que ⌘V funciona desde cualquier pestaña sin tener que ir hasta el dropzone. */}
      <DropoverContent
        title="Ícono del notebook"
        className="md:w-96 gap-0 p-0 max-md:min-h-[300px]"
        onPaste={(e) => upload(e.clipboardData.files[0])}
      >
        <Tabs value={tab} onValueChange={setTab} className="min-h-0 max-md:flex-1 gap-0">
          {/* El borde del header hace de riel del subrayado de la pestaña activa. */}
          <div className="flex items-center border-b px-1.5">
            <TabsList variant="line">
              <TabsTrigger value="iconos">Íconos</TabsTrigger>
              <TabsTrigger value="emojis">Emojis</TabsTrigger>
              <TabsTrigger value="subir">Subir</TabsTrigger>
            </TabsList>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={!icon}
              className="ml-auto text-muted-foreground"
              onClick={() => set(null)}
            >
              Eliminar
            </Button>
          </div>

          {/* Buscador compartido por las dos pestañas de elección (Subir no filtra nada), con
              las dos utilidades al lado: dado (random, aplica sin cerrar) y color — Palette
              cicla tintes presets de íconos lucide, la mano cicla el tono de piel del emoji. */}
          {tab !== "subir" && (
            <div className="flex items-center gap-1 px-2 py-1.5">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar icono o emoji"
                className="h-7 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Elegir uno al azar"
                className="shrink-0 text-muted-foreground"
                onClick={randomPick}
              >
                <Shuffle />
              </Button>
              {tab === "iconos" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cambiar color del ícono"
                  disabled={!icon?.startsWith("lucide:")}
                  className="shrink-0 text-muted-foreground"
                  onClick={cycleTint}
                >
                  {/* Dot del tinte actual: bg-current = el gris con el que se ve el ícono sin
                      tinte; con tinte la clase bg-* pisa y muestra el color real. */}
                  <span
                    className={cn(
                      "size-3.5 rounded-full bg-current",
                      tintIndex >= 0 && TINT_DOTS[tintIndex],
                    )}
                  />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cambiar tono de piel del emoji"
                  disabled={!toneBase || !TONEABLE.has(toneBase)}
                  className="shrink-0"
                  onClick={cycleTone}
                >
                  <span className="text-base leading-none">
                    🖐{toneIndex >= 0 ? TONES[toneIndex] : ""}
                  </span>
                </Button>
              )}
            </div>
          )}

          {/* Íconos lucide agrupados por PRESET_GROUPS; el emoji va por EMOJI_GROUPS. En los dos
              tabs el buscador filtra dentro de cada grupo y corta los vacíos. */}
          <GroupedGrid
            value="iconos"
            groups={presetGroups}
            selected={(n) => icon === `lucide:${n}`}
            onPick={(n) => set(`lucide:${n}`)}
            render={(n) => <NotebookIcon icon={`lucide:${n}`} className="size-5 max-md:size-6" />}
          />

          {/* El emoji se guarda crudo (no 'lucide:' ni http): NotebookIcon lo dibuja como texto,
              igual que los íconos que llegan del import de Notion. La caja fija de 24px centrada
              es lo que alinea los emojis entre sí: los glifos varían de ancho y sueltos hacen
              columnas desprolijas. */}
          <GroupedGrid
            value="emojis"
            nav={q === ""}
            groups={emojiGroups}
            selected={(e) => icon === e}
            onPick={(e) => set(e)}
            render={(emoji) => (
              <span className="grid size-7 place-items-center text-xl leading-none max-md:size-8 max-md:text-2xl">
                {emoji}
              </span>
            )}
          />

          {/* max-md:flex-col: en mobile el botón crece para llenar el alto del drawer (heredado
              de Tabs/TabsContent, ambos flex-1) en vez de quedar chico con hueco vacío debajo. */}
          <TabsContent value="subir" className="p-2.5 max-md:flex max-md:flex-col">
            {/* `preventDefault` en dragOver es lo único que hace la zona soltable: sin eso el
                browser abre la imagen en la pestaña. */}
            <Button
              type="button"
              variant="ghost"
              disabled={uploading}
              className={cn(
                "w-full gap-2 border border-dashed text-base transition-colors md:h-32 max-md:flex-1",
                dragging
                  ? "border-ring bg-muted text-foreground"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
              onClick={() => file.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                upload(e.dataTransfer.files[0])
              }}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <ImageIcon />}
              {uploading ? "Subiendo…" : dragging ? "Soltá acá" : "Subir una imagen"}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              o soltala acá · <Kbd>{MOD}</Kbd>+<Kbd>V</Kbd> para pegarla
            </p>
          </TabsContent>
        </Tabs>
      </DropoverContent>

      {/* Fuera del popover a propósito: si estuviera adentro, cerrarlo desmontaría el input y
          mataría el `change` del archivo elegido. El tipo y el peso los valida el bucket
          (migración 0004); `accept` solo filtra el picker del SO. */}
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={pick}
      />
    </Dropover>
  )
}
