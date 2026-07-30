import { useRef, useState } from "react"
import { Image as ImageIcon, Loader2, Smile } from "lucide-react"
import { toast } from "sonner"
import { CourseIcon, PRESET_ICONS } from "@/courses/course-icon"
import { uploadCourseIcon } from "@/courses/courses.api"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import { cn } from "@/core/lib/utils"
import { Dropover, DropoverContent, DropoverTrigger } from "@/core/ui/dropover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs"

// Popover a lo Notion en desktop, drawer en mobile (Dropover): el trigger es el icono actual y
// adentro van las dos fuentes (presets / imagen propia) en pestañas, más Eliminar. Elegir cierra —
// es un paso del form, no una pantalla.
export function IconPicker({
  icon,
  onChange,
}: {
  icon: string | null
  onChange: (v: string | null) => void
}) {
  const file = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  function set(v: string | null) {
    onChange(v)
    setOpen(false)
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
      set(await uploadCourseIcon(f))
    } catch {
      toast.error("No se pudo subir la imagen")
    } finally {
      setUploading(false)
    }
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = "" // sin esto, reelegir el mismo archivo no dispara change
    upload(f)
  }

  return (
    <Dropover open={open} onOpenChange={setOpen}>
      <DropoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Icono del curso"
          className="size-10 text-muted-foreground"
        >
          {icon ? <CourseIcon icon={icon} className="size-4.5" /> : <Smile />}
        </Button>
      </DropoverTrigger>

      {/* Pegar cuelga del popover/drawer entero, no del tab: se enfoca el content al abrir, así
          que ⌘V funciona desde cualquier pestaña sin tener que ir hasta el dropzone. */}
      <DropoverContent
        title="Ícono del curso"
        className="md:w-64 gap-0 p-0 max-md:min-h-[300px]"
        onPaste={(e) => upload(e.clipboardData.files[0])}
      >
        <Tabs defaultValue="iconos" className="max-md:flex-1 gap-0">
          {/* El borde del header hace de riel del subrayado de la pestaña activa. */}
          <div className="flex items-center border-b px-1.5">
            <TabsList variant="line">
              <TabsTrigger value="iconos">Íconos</TabsTrigger>
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

          {/* 42 presets: 7 columnas dan 6 filas justas, sin fila huérfana. 7 × 32px (size="icon")
              ≈ el ancho útil del popover (w-64 menos este padding), así el margen a los bordes
              queda chico en vez del hueco enorme que dejaban 5 columnas en el mismo ancho.
              (8 columnas no entra: 8 × 32 = 256px > los 244px útiles, se saldría del borde
              redondeado del popover.) Track a min-content + justify-center: el sobrante se
              reparte fuera del grid, no adentro de cada columna, que es lo que infla la
              separación entre íconos. En mobile el drawer es full-bleed (sin los 244px del
              popover) — íconos más grandes (44px, mínimo táctil de las guías de Apple/Google) con
              más gap; 7 × 44px + gaps ≈ 330px, entra en cualquier viewport ≥360px sin overflow. */}
          <TabsContent
            value="iconos"
            className="grid justify-center gap-0 p-1.5 grid-cols-[repeat(7,min-content)] max-md:gap-1"
          >
            {Object.keys(PRESET_ICONS).map((n) => (
              <Button
                key={n}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={n}
                aria-pressed={icon === `lucide:${n}`}
                className={cn(
                  "max-md:size-11",
                  icon === `lucide:${n}` && "bg-muted text-foreground",
                )}
                onClick={() => set(`lucide:${n}`)}
              >
                <CourseIcon icon={`lucide:${n}`} className="max-md:size-6" />
              </Button>
            ))}
          </TabsContent>

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
                "w-full gap-2 border border-dashed transition-colors md:h-16 max-md:flex-1",
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
              o soltala acá · <Kbd>⌘</Kbd>+<Kbd>V</Kbd> para pegarla
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
