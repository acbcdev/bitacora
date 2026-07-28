import { useRef, useState } from "react"
import { Image as ImageIcon, Loader2, Smile } from "lucide-react"
import { toast } from "sonner"
import { CourseIcon, PRESET_ICONS } from "@/courses/course-icon"
import { uploadCourseIcon } from "@/courses/courses.api"
import { Button } from "@/core/ui/button"
import { Kbd } from "@/core/ui/kbd"
import { cn } from "@/core/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/core/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs"

// Popover a lo Notion: el trigger es el icono actual y adentro van las dos fuentes (presets /
// imagen propia) en pestañas, más Eliminar. Elegir cierra — es un paso del form, no una pantalla.
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Icono del curso"
          className="size-10 text-muted-foreground"
        >
          {icon ? <CourseIcon icon={icon} className="size-[18px]" /> : <Smile />}
        </Button>
      </PopoverTrigger>

      {/* Pegar cuelga del popover entero, no del tab: radix enfoca el content al abrir, así que
          ⌘V funciona desde cualquier pestaña sin tener que ir hasta el dropzone. */}
      <PopoverContent className="w-64 gap-0 p-0" onPaste={(e) => upload(e.clipboardData.files[0])}>
        <Tabs defaultValue="iconos" className="gap-0">
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

          {/* 15 presets: 5 columnas dan 3 filas justas, sin fila huérfana. */}
          <TabsContent value="iconos" className="grid grid-cols-5 justify-items-center gap-1 p-2">
            {Object.keys(PRESET_ICONS).map((n) => (
              <Button
                key={n}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={n}
                aria-pressed={icon === `lucide:${n}`}
                className={icon === `lucide:${n}` ? "bg-muted text-foreground" : ""}
                onClick={() => set(`lucide:${n}`)}
              >
                <CourseIcon icon={`lucide:${n}`} />
              </Button>
            ))}
          </TabsContent>

          <TabsContent value="subir" className="p-2.5">
            {/* `preventDefault` en dragOver es lo único que hace la zona soltable: sin eso el
                browser abre la imagen en la pestaña. */}
            <Button
              type="button"
              variant="ghost"
              disabled={uploading}
              className={cn(
                "h-16 w-full gap-2 border border-dashed transition-colors",
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
              o soltala acá · <Kbd>⌘V</Kbd> para pegarla
            </p>
          </TabsContent>
        </Tabs>
      </PopoverContent>

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
    </Popover>
  )
}
