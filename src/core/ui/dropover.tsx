import * as React from "react"

import { useIsMobile } from "@/core/hooks/use-mobile"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/core/ui/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/core/ui/popover"

const DropoverContext = React.createContext<boolean | null>(null)

function useDropoverContext() {
  const isMobile = React.use(DropoverContext)
  if (isMobile === null) {
    throw new Error("Dropover.* debe usarse dentro de <Dropover>")
  }
  return isMobile
}

// Popover flotante en desktop, Drawer desde abajo en mobile: un popover angosto compite mal con
// el teclado táctil y el thumb reach. Mismo trigger/content para el consumidor, el swap es interno.
function Dropover({ children, ...props }: React.ComponentProps<typeof Popover>) {
  const isMobile = useIsMobile()
  const Root = isMobile ? Drawer : Popover
  return (
    <DropoverContext value={isMobile}>
      <Root {...props}>{children}</Root>
    </DropoverContext>
  )
}

function DropoverTrigger(props: React.ComponentProps<typeof PopoverTrigger>) {
  const isMobile = useDropoverContext()
  const Trigger = isMobile ? DrawerTrigger : PopoverTrigger
  return <Trigger {...props} />
}

// Mismo className en los dos, a media queries: el breakpoint de Tailwind (`md` = 768px) matchea
// MOBILE_BREAKPOINT de use-mobile.ts. Sizing que solo aplica de un lado va prefijado
// (`md:w-64` para el ancho del popover, `max-md:min-h-*` para el alto mínimo del drawer) — así
// nunca compite con el `inset-x-0` full-bleed del sheet en mobile.
function DropoverContent({
  title,
  description,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  title: string
  description?: string
}) {
  const isMobile = useDropoverContext()
  if (isMobile) {
    return (
      <DrawerContent {...props}>
        <DrawerHeader className="sr-only">
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        {children}
      </DrawerContent>
    )
  }
  return <PopoverContent {...props}>{children}</PopoverContent>
}

export { Dropover, DropoverTrigger, DropoverContent }
