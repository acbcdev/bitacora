import { useEffect, useState } from "react"
import {
  ArrowLeftIcon,
  CopyIcon,
  KeyboardOffIcon,
  PlusIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react"
import type { Editor } from "@tiptap/react"
import { CONVERTS, duplicate } from "@/core/components/block-controls"
import {
  blockPreview,
  currentBlock,
  insertBelow,
  removeBlock,
} from "@/core/components/block-touch-actions"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/core/ui/drawer"
import { cn } from "@/core/lib/utils"

const BTN =
  "grid h-11 min-w-11 shrink-0 cursor-pointer place-items-center rounded-lg px-2 transition-[background-color,scale] duration-150 ease-out active:scale-95 active:bg-muted [&_svg]:size-5"

const ROW =
  "flex h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-base transition-colors duration-150 ease-out active:bg-muted [&_svg]:size-5 [&_svg]:text-muted-foreground"

// Lo que el teclado deja visible: visualViewport mide el área útil; el resto de abajo es el teclado.
function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const calc = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    calc()
    vv.addEventListener("resize", calc)
    vv.addEventListener("scroll", calc)
    return () => {
      vv.removeEventListener("resize", calc)
      vv.removeEventListener("scroll", calc)
    }
  }, [])
  return inset
}

// Barra pegada arriba del teclado (como Notion). pointerdown preventDefault en toda la barra:
// tocarla NO le saca el foco al editor, así que el teclado no baja.
export function BlockBar({ editor }: { editor: Editor }) {
  const inset = useKeyboardInset()
  const [convert, setConvert] = useState(false)
  const target = currentBlock(editor)
  return (
    <div
      onPointerDown={(e) => e.preventDefault()}
      style={{ bottom: inset }}
      className="fixed inset-x-0 z-40 flex h-12 items-center gap-0.5 overflow-x-auto border-t bg-popover px-1"
    >
      {convert ? (
        <>
          <button className={BTN} aria-label="Volver" onClick={() => setConvert(false)}>
            <ArrowLeftIcon />
          </button>
          {CONVERTS.map((c) => (
            <button
              key={c.label}
              className={BTN}
              aria-label={c.label}
              disabled={!c.can(editor)}
              onClick={() => {
                if (target) c.apply(editor, target)
                setConvert(false)
              }}
            >
              {c.icon}
            </button>
          ))}
        </>
      ) : (
        <>
          <button className={BTN} aria-label="Insertar bloque" onClick={() => insertBelow(editor)}>
            <PlusIcon />
          </button>
          <button className={BTN} aria-label="Convertir en…" onClick={() => setConvert(true)}>
            <TypeIcon />
          </button>
          <button
            className={BTN}
            aria-label="Duplicar bloque"
            onClick={() => target && duplicate(editor)(target)}
          >
            <CopyIcon />
          </button>
          <button
            className={cn(BTN, "text-destructive")}
            aria-label="Borrar bloque"
            onClick={() => removeBlock(editor)}
          >
            <Trash2Icon />
          </button>
          <button
            className={cn(BTN, "ml-auto")}
            aria-label="Cerrar teclado"
            onClick={() => editor.commands.blur()}
          >
            <KeyboardOffIcon />
          </button>
        </>
      )}
    </div>
  )
}

// Sheet con todas las acciones (tap en el asa, o long-press sin arrastrar). Corre la acción
// DESPUÉS de cerrar: el drawer devuelve el foco al trigger y pisaría el focus() de la acción.
export function BlockSheet({
  editor,
  open,
  onClose,
}: {
  editor: Editor
  open: boolean
  onClose: () => void
}) {
  const target = open ? currentBlock(editor) : null
  const run = (fn: () => void) => () => {
    onClose()
    setTimeout(fn, 50)
  }
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerTitle className="sr-only">Acciones del bloque</DrawerTitle>
        <DrawerDescription className="sr-only">
          Convertir, insertar, duplicar o borrar
        </DrawerDescription>
        <div className="px-4 pt-3 pb-2">
          <p className="eyebrow">Bloque</p>
          <p className="truncate text-base font-medium">{open ? blockPreview(editor) : ""}</p>
        </div>
        <p className="px-4 pb-1.5 text-2xs text-muted-foreground">Convertir en</p>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {CONVERTS.map((c) => (
            <button
              key={c.label}
              disabled={!c.can(editor)}
              onClick={run(() => target && c.apply(editor, target))}
              className="flex h-14 min-w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border text-2xs text-muted-foreground transition-[background-color,scale] duration-150 ease-out active:scale-95 active:bg-muted disabled:opacity-40 [&_svg]:size-4 [&_svg]:text-foreground"
            >
              {c.icon}
              {c.label}
            </button>
          ))}
        </div>
        <div className="border-t px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button className={ROW} onClick={run(() => insertBelow(editor))}>
            <PlusIcon /> Insertar debajo
          </button>
          <button className={ROW} onClick={run(() => target && duplicate(editor)(target))}>
            <CopyIcon /> Duplicar
          </button>
          <button
            className={cn(ROW, "text-destructive [&_svg]:text-destructive")}
            onClick={run(() => removeBlock(editor))}
          >
            <Trash2Icon /> Borrar
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
