import { render } from "@testing-library/react"
import { Drialog, DrialogContent, DrialogHeader, DrialogTitle } from "@/core/ui/drialog"

// use-mobile.ts decide por window.innerWidth (matchMedia solo dispara el listener de cambio).
// jsdom no implementa matchMedia — el stub evita el "not implemented" al montar.
function setViewport(width: number) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width })
}

function Fixture({ className }: { className: string }) {
  return (
    <Drialog open>
      <DrialogContent showCloseButton={false} className={className}>
        <DrialogHeader>
          <DrialogTitle>Test</DrialogTitle>
        </DrialogHeader>
        contenido
      </DrialogContent>
    </Drialog>
  )
}

describe("Drialog", () => {
  it("mobile: renderiza Drawer, className del caller pasa directo (a media queries)", () => {
    setViewport(500)
    render(<Fixture className="max-md:max-h-[90vh]" />)
    const content = document.querySelector('[data-slot="drawer-content"]')
    expect(content).toHaveClass("max-md:max-h-[90vh]")
    expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeInTheDocument()
    // showCloseButton es prop de DialogContent: si se reenvía tal cual a DrawerContent termina
    // como atributo suelto en el DOM y React avisa por consola.
    expect(content).not.toHaveAttribute("showclosebutton")
    // El título tiene que ser el de vaul: adentro de Drawer.Root el de Radix no encuentra contexto.
    expect(document.querySelector('[data-slot="drawer-title"]')).toBeInTheDocument()
  })

  it("desktop: renderiza Dialog, className del caller pasa directo", () => {
    setViewport(1280)
    render(<Fixture className="md:max-w-5xl" />)
    expect(document.querySelector('[data-slot="dialog-content"]')).toHaveClass("md:max-w-5xl")
    expect(document.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument()
    expect(document.querySelector('[data-slot="dialog-title"]')).toBeInTheDocument()
  })
})
