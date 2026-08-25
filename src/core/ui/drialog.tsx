import * as React from "react"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/core/ui/drawer"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/ui/dialog"

const DrialogContext = React.createContext<boolean | null>(null)

function useDrialogContext() {
  const isMobile = React.use(DrialogContext)
  if (isMobile === null) {
    throw new Error("Drialog.* debe usarse dentro de <Drialog>")
  }
  return isMobile
}

// Dialog flotante en desktop, Drawer desde abajo en mobile: el dialog deja márgenes a los 4 lados
// (`max-w-[calc(100%-2rem)]`) y en 375px eso más el padding del contenido son ~19% del ancho de
// lectura — justo sobre la superficie donde hay que llegar al final para poder marcar leído.
// Espejo 1:1 de las primitivas (sin Trigger: los consumidores son controlados), el swap es interno.
function Drialog({ children, ...props }: React.ComponentProps<typeof Dialog>) {
  const isMobile = useIsMobile()
  const Root = isMobile ? Drawer : Dialog
  return (
    <DrialogContext value={isMobile}>
      <Root {...props}>{children}</Root>
    </DrialogContext>
  )
}

// Mismo className en los dos, a media queries: el breakpoint de Tailwind (`md` = 768px) matchea
// MOBILE_BREAKPOINT de use-mobile.ts. Sizing que solo aplica de un lado va prefijado
// (`md:max-w-5xl` para el dialog, `max-md:max-h-*` para el alto del drawer). NO usar `sm:` (640)
// para decidir mobile: entre 640 y 767 esto ya es Drawer y un `sm:max-w-*` encima del `inset-x-0`
// full-bleed deja un sheet angosto pegado a la izquierda.
//
// ponytail: drag default de vaul. Si cerrar sin querer molesta en uso real, el upgrade es
// <div> → <DrawerPrimitive.Handle> en drawer.tsx:53 + handleOnly acá.
function DrialogContent({ showCloseButton, ...props }: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useDrialogContext()
  // showCloseButton es de DialogContent: reenviarlo a DrawerContent lo deja como atributo suelto.
  if (isMobile) return <DrawerContent {...props} />
  return <DialogContent showCloseButton={showCloseButton} {...props} />
}

function DrialogHeader(props: React.ComponentProps<"div">) {
  const Header = useDrialogContext() ? DrawerHeader : DialogHeader
  return <Header {...props} />
}

// No es opcional: el título vive adentro del Root y la primitiva de Radix no encuentra su contexto
// dentro de un Drawer.Root — vaul trae el suyo.
function DrialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
  const Title = useDrialogContext() ? DrawerTitle : DialogTitle
  return <Title {...props} />
}

export { Drialog, DrialogContent, DrialogHeader, DrialogTitle }
