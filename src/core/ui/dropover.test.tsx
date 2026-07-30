import { render } from "@testing-library/react"
import { Dropover, DropoverContent, DropoverTrigger } from "@/core/ui/dropover"

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

describe("Dropover", () => {
  it("mobile: renderiza Drawer, className del caller pasa directo (a media queries)", () => {
    setViewport(500)
    render(
      <Dropover open>
        <DropoverTrigger>abrir</DropoverTrigger>
        <DropoverContent title="Test" className="max-md:min-h-[300px]">
          contenido
        </DropoverContent>
      </Dropover>,
    )
    expect(document.querySelector('[data-slot="drawer-content"]')).toHaveClass(
      "max-md:min-h-[300px]",
    )
    expect(document.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument()
  })

  it("desktop: renderiza Popover, className del caller pasa directo", () => {
    setViewport(1280)
    render(
      <Dropover open>
        <DropoverTrigger>abrir</DropoverTrigger>
        <DropoverContent title="Test" className="md:w-64">
          contenido
        </DropoverContent>
      </Dropover>,
    )
    expect(document.querySelector('[data-slot="popover-content"]')).toHaveClass("md:w-64")
    expect(document.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument()
  })
})
