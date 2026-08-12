import { useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import { cn } from "@/core/lib/utils"

type Heading = { el: HTMLElement; level: number; text: string }

// Ancho del tick y sangría del panel por nivel: solo h1 y h2 (h3+ no entra al rail, ver abajo).
const TICK = ["w-6", "w-4"]
const INDENT = ["pl-2", "pl-5"]

// Rail de headings al margen derecho de la nota (ver docs/adr/0007-outline-desde-el-dom.md).
// Los headings salen del DOM del host, no del doc de Tiptap: el click necesita el elemento al que
// scrollear, y así el componente no sabe nada del editor ni de qué contenedor scrollea.
export function Outline({
  host,
  version,
}: {
  host: RefObject<HTMLElement | null>
  version: number
}) {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState(0)
  const activeItem = useRef<HTMLButtonElement>(null)

  // Rescaneo con debounce: el editor avisa por `version` cada vez que cambia el contenido, no hace
  // falta un MutationObserver.
  // Solo h1/h2: h3 es el 42% de los headings del import y hace ruido en las notas largas. El costo
  // está medido y aceptado: 222 de las 673 notas con outline se quedan sin rail (160 usan solo h3).
  useEffect(() => {
    const t = setTimeout(() => {
      const els = host.current?.querySelectorAll<HTMLElement>("h1, h2") ?? []
      setHeadings(
        [...els].map((el) => ({
          el,
          level: Number(el.tagName[1]),
          text: el.textContent ?? "",
        })),
      )
    }, 300)
    return () => clearTimeout(t)
  }, [host, version])

  // Activo: gana el último heading que cruzó el borde superior del scroller. El rootMargin recorta
  // la zona de intersección a la banda de arriba; si no queda ninguno adentro, sigue el anterior.
  // Misma lógica editando que leyendo.
  useEffect(() => {
    if (!headings.length) return
    const visible = new Set<Element>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target)
          else visible.delete(e.target)
        }
        const last = headings.findLastIndex((h) => visible.has(h.el))
        if (last >= 0) setActive(last)
      },
      { rootMargin: "0px 0px -80% 0px" },
    )
    for (const h of headings) io.observe(h.el)
    return () => io.disconnect()
  }, [headings])

  // 27% de las notas tienen 0 o 1 heading: ahí el rail es chrome inútil.
  if (headings.length < 2) return null

  const jump = (h: Heading) =>
    h.el.scrollIntoView({
      // Excepción consciente a "sin animaciones": el movimiento ES el feedback de cuánto saltaste.
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    })

  return (
    // sticky, nunca fixed: se ancla al scrollport ancestro sea cual sea (main, #note-pane o el div
    // del dialog de Repaso). Va primero en el flujo — sticky no sube por encima de su posición
    // natural — y con altura 0 para no ocupar espacio del documento.
    // hidden md:block: en touch no hay hover ni margen donde ponerlo.
    // El rail arranca arriba y crece hacia abajo (como el de Notion), no centrado — con 40+ ticks,
    // centrarlo se comía media pantalla.
    // top-48 + `-top-40` en el nav: sticky no puede subir por encima de su posición natural, que
    // acá es el arranque del cuerpo de la nota (debajo del título). El offset negativo del nav lo
    // levanta 160px en scroll 0; la línea de sticky (192px) es más grande que ese offset a
    // propósito, así cuando queda pegado aterriza a 32px del borde del scroller y nunca se corta.
    <div className="sticky top-48 z-10 hidden h-0 md:block">
      <nav
        aria-label="Secciones"
        // El offset negativo saca el rail de la columna de texto y lo lleva al gutter, cerca del
        // borde del contenedor. Escalonado por breakpoint y siempre corto: el rail no puede pasarse
        // del padding del scroller — `overflow-y-auto` hace que overflow-x compute a `auto`, así que
        // asomarse un pixel de más le mete un scrollbar horizontal al dialog de Repaso.
        // pl-6: zona de hover más ancha que los ticks, para no tener que apuntar a 2px.
        className="group absolute -top-40 -right-6 flex flex-col items-end gap-1.5 py-2 pl-6 lg:-right-10 xl:-right-32 2xl:-right-36"
        onMouseEnter={() => activeItem.current?.scrollIntoView({ block: "nearest" })}
      >
        {headings.map((h, i) => (
          <button
            key={i}
            data-outline-tick
            aria-label={h.text}
            aria-current={i === active || undefined}
            // preventDefault: clickear el rail mientras escribís no le roba el foco al editor.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => jump(h)}
            className={cn(
              "h-0.5 rounded-full transition-colors",
              TICK[h.level - 1],
              i === active ? "bg-foreground" : "bg-muted-foreground/40",
            )}
          />
        ))}
        {/* Panel de títulos: hermano de los ticks, puro CSS — sin estado ni timers. Abre encima
            del texto (a 1280px el margen contra un texto de 80ch no alcanza) y encima de los ticks:
            `right-0` lo alinea con el rail y, al ser el único hermano posicionado, pinta arriba.
            top-0: abre desde el primer tick hacia abajo, igual que el rail. */}
        <div className="pointer-events-none absolute top-0 right-0 max-h-[70vh] w-60 overflow-y-auto rounded-lg border bg-popover p-1.5 opacity-0 shadow-lg transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          {headings.map((h, i) => (
            <button
              key={i}
              ref={i === active ? activeItem : null}
              aria-current={i === active || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => jump(h)}
              className={cn(
                "block w-full truncate rounded py-1 pr-2 text-left text-sm hover:bg-accent",
                INDENT[h.level - 1],
                i === active ? "font-medium text-foreground" : "text-fg-secondary",
              )}
            >
              {h.text}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
