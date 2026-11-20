import { useEffect, useRef, useState, type RefObject } from "react"
import { Link } from "react-router-dom"
import { Bot, House, LayoutList, PanelLeft, Plus, Search } from "lucide-react"
import { cn } from "@/core/lib/utils"
import { useSnapshot } from "@/core/lib/snapshot"
import { dailyCompliance } from "@/core/store/derive"
import { SidebarTrigger } from "@/core/ui/sidebar"
import { currentSection, switchLine, type Section } from "@/core/components/mobile-section"
import { DailyBars } from "@/review/review-stats"

// Chrome de mobile (md:hidden): barra pegada arriba + dock en la zona del pulgar. En desktop no existe.
const TITLE: Record<Section, string> = {
  repaso: "Repaso",
  habitos: "Hábitos",
  notebooks: "Notebooks",
}

// La sección visible sale de las cabeceras [data-section] y de qué % de pantalla ocupan (mobile-section.ts).
function useSection(
  scroller: RefObject<HTMLElement | null>,
  bar: RefObject<HTMLElement | null>,
  on: boolean,
) {
  const [section, setSection] = useState<Section>("repaso")
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const main = scroller.current
    if (!main || !on) {
      setSection("repaso")
      return
    }
    const calc = () => {
      const heads = [...main.querySelectorAll<HTMLElement>("[data-section]")].map((e) => ({
        section: e.dataset.section as Section,
        top: e.getBoundingClientRect().top,
      }))
      const barBottom = bar.current?.getBoundingClientRect().bottom ?? 0
      setSection(currentSection(heads, switchLine(barBottom, main.getBoundingClientRect().bottom)))
      setStuck(main.scrollTop > 4)
    }
    calc()
    main.addEventListener("scroll", calc, { passive: true })
    // El contenido carga async y cambia de alto: recalcular cuando cambia.
    const ro = new ResizeObserver(calc)
    for (const c of main.children) ro.observe(c)
    return () => {
      main.removeEventListener("scroll", calc)
      ro.disconnect()
    }
  }, [scroller, bar, on])
  return { section, stuck }
}

const BTN =
  "grid size-11 shrink-0 cursor-pointer place-items-center rounded-pill text-muted-foreground transition-[color,scale] duration-150 ease-out active:scale-95 hover:text-foreground"

export function MobileBar({
  scroller,
  home,
  onHabits,
  onNewHabit,
  onNewNotebook,
}: {
  scroller: RefObject<HTMLElement | null>
  home: boolean
  onHabits: () => void
  onNewHabit: () => void
  onNewNotebook: () => void
}) {
  const bar = useRef<HTMLElement>(null)
  const { section, stuck } = useSection(scroller, bar, home)
  const { data: days = [] } = useSnapshot((s) => dailyCompliance(s))
  return (
    <header
      ref={bar}
      className={cn(
        "sticky top-0 z-20 flex h-14 items-center gap-1 border-b bg-background/85 px-2 backdrop-blur transition-[border-color] duration-150 md:hidden",
        stuck ? "border-border" : "border-transparent",
      )}
    >
      <SidebarTrigger className="size-11 shrink-0" aria-label="Abrir menú">
        <PanelLeft className="size-5" />
      </SidebarTrigger>
      {/* Slot para acciones de la pantalla (ej. la pastilla de notas del Notebook, por portal). */}
      {!home && <div id="mobile-bar-slot" className="ml-auto flex min-w-0 items-center" />}
      {home && (
        <>
          <span
            key={section}
            className="animate-in text-xl font-semibold tracking-tight duration-150 ease-out fade-in"
          >
            {TITLE[section]}
          </span>
          {/* Las acciones cambian con la sección: lo que se puede hacer es lo que tenés a la vista. */}
          <div className="ml-auto flex items-center">
            {section === "repaso" && (
              <span className="pr-3">
                <DailyBars days={days} />
              </span>
            )}
            {section === "habitos" && (
              <>
                <button
                  type="button"
                  className={BTN}
                  onClick={onHabits}
                  aria-label="Ver todos los hábitos"
                >
                  <LayoutList className="size-5" />
                </button>
                <button
                  type="button"
                  className={BTN}
                  onClick={onNewHabit}
                  aria-label="Nuevo hábito"
                >
                  <Plus className="size-5" />
                </button>
              </>
            )}
            {section === "notebooks" && (
              <button
                type="button"
                className={BTN}
                onClick={onNewNotebook}
                aria-label="Nuevo notebook"
              >
                <Plus className="size-5" />
              </button>
            )}
          </div>
        </>
      )}
    </header>
  )
}

const DOCK_ITEM =
  "flex h-12 cursor-pointer items-center gap-2 rounded-pill px-4 text-sm font-medium text-muted-foreground transition-[color,background-color,scale] duration-150 ease-out active:scale-95"

export function MobileDock({
  scroller,
  home,
  onSearch,
  onAgent,
}: {
  scroller: RefObject<HTMLElement | null>
  home: boolean
  onSearch: () => void
  // Sin esto no hay ícono: en notebooks el Agente vive en la barra, junto a la pastilla de notas.
  onAgent?: () => void
}) {
  return (
    <nav
      aria-label="Navegación"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-pill bg-hero/90 p-1 shadow-hero ring-1 ring-border backdrop-blur in-data-[editing]:hidden md:hidden"
    >
      <Link
        to="/"
        aria-current={home ? "page" : undefined}
        // Ya en Hoy: "Inicio" sube al tope en vez de no hacer nada.
        onClick={() => home && scroller.current?.scrollTo({ top: 0, behavior: "smooth" })}
        className={cn(DOCK_ITEM, home && "bg-muted text-foreground")}
      >
        <House className="size-5" />
        Inicio
      </Link>
      <button type="button" onClick={onSearch} className={DOCK_ITEM}>
        <Search className="size-5" />
        Buscar
      </button>
      {onAgent && (
        <button type="button" onClick={onAgent} className={DOCK_ITEM}>
          <Bot className="size-5" />
          Agente
        </button>
      )}
    </nav>
  )
}
